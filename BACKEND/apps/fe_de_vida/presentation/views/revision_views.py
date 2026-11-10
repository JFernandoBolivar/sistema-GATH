"""
Vistas de BIENESTAR SOCIAL (C5): bandeja, detalle con comparativo, foto (bytes por streaming), doble check,
aprobación directa con justificación, rechazo y solicitud de repetición. Vistas delgadas; sin ORM.
"""
from django.conf import settings
from django.db import transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.views import APIView

from apps.fe_de_vida.application.use_cases.constancias import (
    reenviar_constancia,
    regenerar_constancia,
)
from apps.fe_de_vida.application.use_cases.consultas import (
    bandeja_revision,
    detalle_para_revision,
    evidencia_para_revision,
)
from apps.fe_de_vida.application.use_cases.revision import (
    aprobar_directo,
    dar_check,
    rechazar,
    retirar_check,
    devolver,
)
from apps.fe_de_vida.domain.entities.filtros import FiltroBandeja
from apps.fe_de_vida.domain.entities.solicitud import PermisosRevision
from apps.fe_de_vida.domain.value_objects.estados import RolRevision
from apps.fe_de_vida.infrastructure.adaptadores_autogestion import (
    AplicadorCambiosActaORM,
    LectorValorActualORM,
    RepoCambiosActaORM,
)
from apps.fe_de_vida.infrastructure.pdf.constancia_pdf import GeneradorConstanciaPDF
from apps.fe_de_vida.infrastructure.repositories.lector_ficha_pasivo_orm import LectorFichaPasivoORM
from apps.fe_de_vida.infrastructure.repositories.lector_pasivos_orm import LectorPasivosORM
from apps.fe_de_vida.infrastructure.repositories.repo_constancias_orm import RepoConstanciasORM
from apps.fe_de_vida.infrastructure.repositories.repo_procesos_orm import RepoProcesosORM
from apps.fe_de_vida.infrastructure.repositories.repo_solicitudes_orm import RepoSolicitudesFeDeVidaORM
from apps.fe_de_vida.infrastructure.signals import PublicadorSenales
from apps.fe_de_vida.presentation.permissions import fe_de_vida_permissions as permisos
from apps.fe_de_vida.presentation.serializers.fe_de_vida_serializers import (
    DetalleRevisionSerializer,
    FiltroBandejaSerializer,
    JustificacionSerializer,
    DevolverSerializer,
    MotivoSerializer,
    ReenvioConstanciaRespuestaSerializer,
    RegenerarConstanciaEntradaSerializer,
    RegenerarConstanciaRespuestaSerializer,
    SolicitudSerializer,
    a_dict_revision,
    a_dict_solicitud,
)
from apps.fe_de_vida.presentation.views._comun import (
    actor_revision,
    ahora,
    auditar,
    cedula_de_sesion,
    parametros_pagina,
    respuesta_pagina,
    resumen,
    validar_entrada,
)
from core.domain.configuracion import (
    CLAVE_FE_DE_VIDA_ADMIN_REGISTRADORA_PUEDE_APROBAR,
    CLAVE_FE_DE_VIDA_REGISTRADOR_PUEDE_CHECAR,
)
from core.domain.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from core.infrastructure.providers import obtener_lector_configuracion, obtener_notificador
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from core.presentation.archivos import respuesta_archivo
from core.presentation.envelope import ok
from core.presentation.permissions import usuario_tiene_permiso
from core.presentation.schema import MensajeRespuestaSerializer

TAG = ['Fe de vida · Bienestar']
ERRORES = {400: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer, 404: MensajeRespuestaSerializer,
           409: MensajeRespuestaSerializer}
NOMBRE_CONSTANCIA = 'constancia-fe-de-vida.pdf'


def _parametro_booleano(clave: str) -> bool:
    """Lee un interruptor de Parámetros del sistema; ante cualquier falla queda apagado (lo más restrictivo)."""
    try:
        lector = obtener_lector_configuracion()
        if lector:
            return lector.obtener_booleano(clave)
    except Exception:
        pass
    return False


def _registrador_puede_checar() -> bool:
    return _parametro_booleano(CLAVE_FE_DE_VIDA_REGISTRADOR_PUEDE_CHECAR)


def _admin_registradora_puede_aprobar() -> bool:
    return _parametro_booleano(CLAVE_FE_DE_VIDA_ADMIN_REGISTRADORA_PUEDE_APROBAR)


def _admin_registradora_puede_decidir() -> bool:
    """Con el parámetro encendido la Administradora revisa su propio registro (check, devolver, rechazar y
    retirar), además de la aprobación directa."""
    return _admin_registradora_puede_aprobar()


class BandejaView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.REVISAR, permisos.VER_PANEL)

    @extend_schema(
        tags=TAG, summary='Bandeja de fe de vida (paginada y filtrable)',
        parameters=[
            OpenApiParameter('texto', str, description='Cédula o nombre'), OpenApiParameter('estado', str),
            OpenApiParameter('proceso_id', str), OpenApiParameter('desde', str, description='YYYY-MM-DD'),
            OpenApiParameter('hasta', str, description='YYYY-MM-DD'),
            OpenApiParameter('historico', bool, description='Si es True, lista solicitudes de procesos cerrados'),
            OpenApiParameter('limit', int, description='Por defecto 10, máximo 50'), OpenApiParameter('offset', int),
        ],
        responses={200: SolicitudSerializer(many=True), 400: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer},
    )
    def get(self, request):
        filtros = validar_entrada(FiltroBandejaSerializer, request.query_params)
        limite, desplazamiento = parametros_pagina(filtros)
        proceso_id = filtros.get('proceso_id')
        filas, total = bandeja_revision(
            RepoSolicitudesFeDeVidaORM(), LectorPasivosORM(), limite=limite, desplazamiento=desplazamiento,
            filtro=FiltroBandeja(
                proceso_id=str(proceso_id) if proceso_id else None, estado=filtros.get('estado'),
                texto=filtros.get('texto'), desde=filtros.get('desde'), hasta=filtros.get('hasta'),
                historico=bool(filtros.get('historico', False)),
            ),
            repo_proc=RepoProcesosORM(),
        )
        return ok(respuesta_pagina(total, filtros, [a_dict_solicitud(s, nombre) for s, nombre in filas]))


class DetalleRevisionView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.REVISAR, permisos.VER_PANEL)

    @extend_schema(
        tags=TAG, summary='Detalle de una fe de vida con el comparativo valor actual / propuesto',
        description='Incluye la ficha completa del pasivo (solo con `fe_de_vida.revisar`) y `acciones_disponibles` del '
                    'usuario actual, calculadas por el dominio.',
        responses={200: DetalleRevisionSerializer, 403: MensajeRespuestaSerializer, 404: MensajeRespuestaSerializer},
    )
    def get(self, request, solicitud_id):
        def puede(codigo):
            return usuario_tiene_permiso(request.user, codigo)

        permisos_revisor = PermisosRevision(
            revisar=puede(permisos.REVISAR), aprobar_directo=puede(permisos.APROBAR_DIRECTO),
            regenerar=puede(permisos.CHECK_ADMINISTRADORA),
            check=puede(permisos.CHECK_ANALISTA) or puede(permisos.CHECK_ADMINISTRADORA),
        )
        detalle = detalle_para_revision(
            RepoSolicitudesFeDeVidaORM(), RepoCambiosActaORM(), LectorValorActualORM(), LectorPasivosORM(),
            solicitud_id=str(solicitud_id), lector_ficha=LectorFichaPasivoORM() if permisos_revisor.revisar else None,
            actor=actor_revision(request), permisos=permisos_revisor, repo_procesos=RepoProcesosORM(),
            registrador_puede_checar=_registrador_puede_checar(),
            registrador_puede_aprobar_directo=_admin_registradora_puede_aprobar(),
        )
        return ok(a_dict_revision(detalle))


class EvidenciaRevisionView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.VER_EVIDENCIA)

    @extend_schema(
        tags=TAG, summary='Foto con la cédula (bytes de la imagen; cada consulta se audita)',
        description='Responde la imagen (image/jpeg, image/png o image/webp) por streaming con `Cache-Control: '
                    'private, no-store`. El almacén no se expone al navegador.',
        responses={200: OpenApiTypes.BINARY, 403: MensajeRespuestaSerializer, 404: MensajeRespuestaSerializer},
    )
    def get(self, request, solicitud_id):
        actor = cedula_de_sesion(request)
        with transaction.atomic():
            evidencia = evidencia_para_revision(
                RepoSolicitudesFeDeVidaORM(), PublicadorSenales(), solicitud_id=str(solicitud_id), actor_cedula=actor,
            )
            auditar(request, 'EVIDENCIA_CONSULTADA', str(solicitud_id), None, None)
            respuesta = respuesta_archivo(
                SeaweedFSStorage(), evidencia.clave, cache='private, no-store', mime=evidencia.mime or None,
            )
        respuesta['Content-Disposition'] = 'inline'
        return respuesta


class CheckView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.CHECK_ANALISTA, permisos.CHECK_ADMINISTRADORA)

    @extend_schema(
        tags=TAG, summary='Dar mi check (Analista o Administradora, orden indistinto)',
        description='El primer check deja la solicitud en PENDIENTE_SEGUNDO_CHECK; el segundo, de otra persona y del '
                    'otro rol, la valida y aplica el acta a los datos reales. El rol se deduce del permiso.',
        request=None, responses={200: SolicitudSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        actor = actor_revision(request, exigir_check=True)
        with transaction.atomic():
            repo = RepoSolicitudesFeDeVidaORM()
            anterior = repo.obtener(str(solicitud_id))
            previa = resumen(anterior) if anterior else None
            solicitud = dar_check(
                repo, AplicadorCambiosActaORM(), PublicadorSenales(), solicitud_id=str(solicitud_id), actor=actor, ahora=ahora(),
                registrador_puede_checar=_registrador_puede_checar(),
                admin_registradora_puede_decidir=_admin_registradora_puede_decidir(),
            )
            auditar(request, 'CHECK_DADO', solicitud.id, previa,
                    {**resumen(solicitud), 'rol': actor.rol.value,
                     'registrador_tambien_aprobo': solicitud.registrador_tambien_aprobo})
        return ok(a_dict_solicitud(solicitud), 'Check registrado.')


class RetirarCheckView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.CHECK_ANALISTA, permisos.CHECK_ADMINISTRADORA)

    @extend_schema(
        tags=TAG, summary='Retirar mi check (solo quien lo dio, antes de que se complete la validación)',
        description='Exige una justificación (mínimo 5 palabras y 20 caracteres, sin HTML). Sin checks restantes la '
                    'solicitud vuelve a PENDIENTE_REVISION. Se audita (CHECK_RETIRADO) y se avisa a Bienestar. '
                    '409 si no tiene un check propio vigente o el estado no lo permite.',
        request=MotivoSerializer, responses={200: SolicitudSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        datos = validar_entrada(MotivoSerializer, request.data)
        actor = actor_revision(request, exigir_check=True)
        with transaction.atomic():
            repo = RepoSolicitudesFeDeVidaORM()
            anterior = repo.obtener(str(solicitud_id))
            previa = resumen(anterior) if anterior else None
            solicitud = retirar_check(
                repo, PublicadorSenales(), solicitud_id=str(solicitud_id), actor=actor, motivo=datos['motivo'], ahora=ahora(),
                registrador_puede_checar=_registrador_puede_checar(),
                admin_registradora_puede_decidir=_admin_registradora_puede_decidir(),
            )
            auditar(request, 'CHECK_RETIRADO', solicitud.id, previa,
                    {**resumen(solicitud), 'rol': actor.rol.value, 'motivo': solicitud.decisiones[-1].motivo})
        return ok(a_dict_solicitud(solicitud), 'Check retirado.')


class AprobarDirectoView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.APROBAR_DIRECTO)

    @extend_schema(
        tags=TAG, summary='Aprobación directa de la Administradora (justificación obligatoria)',
        request=JustificacionSerializer, responses={200: SolicitudSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        datos = validar_entrada(JustificacionSerializer, request.data)
        actor = actor_revision(request)
        if actor.rol is not RolRevision.ADMINISTRADORA:
            raise PermissionDeniedError("Solo la Administradora puede aprobar de forma directa.")
        with transaction.atomic():
            solicitud = aprobar_directo(
                RepoSolicitudesFeDeVidaORM(), AplicadorCambiosActaORM(), PublicadorSenales(),
                solicitud_id=str(solicitud_id), actor=actor, justificacion=datos['justificacion'], ahora=ahora(),
                registrador_puede_aprobar_directo=_admin_registradora_puede_aprobar(),
            )
            auditar(request, 'APROBACION_DIRECTA_ADMINISTRADORA', solicitud.id, None,
                    {**resumen(solicitud), 'justificacion': datos['justificacion'],
                     'registrador_tambien_aprobo': solicitud.registrador_tambien_aprobo})
        return ok(a_dict_solicitud(solicitud), 'Fe de vida validada por aprobación directa.')


class RechazarView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.REVISAR)

    @extend_schema(tags=TAG, summary='Rechazar la fe de vida (motivo obligatorio)',
                   request=MotivoSerializer, responses={200: SolicitudSerializer, **ERRORES})
    def post(self, request, solicitud_id):
        datos = validar_entrada(MotivoSerializer, request.data)
        with transaction.atomic():
            solicitud = rechazar(
                RepoSolicitudesFeDeVidaORM(), PublicadorSenales(), solicitud_id=str(solicitud_id),
                actor=actor_revision(request), motivo=datos['motivo'], ahora=ahora(),
                registrador_puede_checar=_registrador_puede_checar(),
                admin_registradora_puede_decidir=_admin_registradora_puede_decidir(),
            )
            auditar(request, 'RECHAZADA', solicitud.id, None, {**resumen(solicitud), 'motivo': datos['motivo']})
        return ok(a_dict_solicitud(solicitud), 'Fe de vida rechazada.')


class DevolverView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.REVISAR)

    @extend_schema(
        tags=TAG, summary='Devolver la fe de vida para corrección (motivo obligatorio)',
        description='El pasivo corrige los datos del acta y reenvía. `requiere_nueva_foto`: además debe cambiar la foto.',
        request=DevolverSerializer, responses={200: SolicitudSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        datos = validar_entrada(DevolverSerializer, request.data)
        with transaction.atomic():
            solicitud = devolver(
                RepoSolicitudesFeDeVidaORM(), PublicadorSenales(), solicitud_id=str(solicitud_id),
                actor=actor_revision(request), motivo=datos['motivo'],
                requiere_nueva_foto=datos['requiere_nueva_foto'], ahora=ahora(),
                registrador_puede_checar=_registrador_puede_checar(),
                admin_registradora_puede_decidir=_admin_registradora_puede_decidir(),
            )
            auditar(request, 'SOLICITUD_DEVUELTA', solicitud.id, None,
                    {**resumen(solicitud), 'motivo': datos['motivo'], 'requiere_nueva_foto': datos['requiere_nueva_foto']})
        return ok(a_dict_solicitud(solicitud), 'Fe de vida devuelta para corrección.')


class ReenviarConstanciaView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.REVISAR)

    @extend_schema(
        tags=TAG, summary='Reenviar la constancia de fe de vida por correo',
        description='Reenvía el PDF al correo de acceso del pasivo (+ copia al alternativo si es distinto). Límite de 5 reenvíos por día.',
        request=None,
        responses={200: ReenvioConstanciaRespuestaSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        notificador = obtener_notificador()
        if notificador is None:
            raise ConflictError("Servicio de notificaciones no disponible.")
        with transaction.atomic():
            resultado = reenviar_constancia(
                RepoSolicitudesFeDeVidaORM(), RepoConstanciasORM(), RepoProcesosORM(),
                LectorPasivosORM(), notificador,
                solicitud_id=str(solicitud_id), actor_cedula=cedula_de_sesion(request), ahora=ahora(),
            )
            auditar(
                request, 'CONSTANCIA_REENVIADA', resultado['numero'],
                nuevo={
                    'solicitud_id': str(solicitud_id),
                    'destinatario': resultado['destinatario'],
                    'copia': resultado['copia'],
                    'reenvios_hoy': resultado['reenvios_hoy'],
                },
                recurso_tipo='ConstanciaFeDeVida',
            )
        msg = f"Constancia reenviada a {resultado['destinatario_enmascarado']}"
        if resultado.get('copia_enmascarada'):
            msg += f" (con copia a {resultado['copia_enmascarada']})"
        return ok(resultado, msg)


class RegenerarConstanciaView(APIView):
    # Solo la administradora: regenerar reemplaza el PDF emitido (el número y el código se conservan).
    permission_classes = permisos.permisos_bienestar(permisos.CHECK_ADMINISTRADORA)

    @extend_schema(
        tags=TAG, summary='Regenerar la constancia de fe de vida (PDF)',
        description='Regenera el PDF con el MISMO número y código de verificación, plantilla y URL vigentes. Admite opción de reenviar.',
        request=RegenerarConstanciaEntradaSerializer,
        responses={200: RegenerarConstanciaRespuestaSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        datos = validar_entrada(RegenerarConstanciaEntradaSerializer, request.data)
        reenviar = datos.get('reenviar', False)
        with transaction.atomic():
            constancia = regenerar_constancia(
                RepoProcesosORM(), RepoSolicitudesFeDeVidaORM(), RepoConstanciasORM(),
                LectorPasivosORM(), GeneradorConstanciaPDF(), SeaweedFSStorage(),
                solicitud_id=str(solicitud_id), url_verificacion_base=settings.FE_DE_VIDA_URL_VERIFICACION,
                ahora=ahora(),
            )
            auditar(
                request, 'CONSTANCIA_REGENERADA', constancia.numero,
                nuevo={
                    'solicitud_id': str(solicitud_id),
                    'plantilla_version': constancia.plantilla_version,
                    'reenviar': reenviar,
                },
                recurso_tipo='ConstanciaFeDeVida',
            )
            reenvio_res = None
            if reenviar:
                notificador = obtener_notificador()
                if notificador is None:
                    raise ConflictError("Servicio de notificaciones no disponible.")
                reenvio_res = reenviar_constancia(
                    RepoSolicitudesFeDeVidaORM(), RepoConstanciasORM(), RepoProcesosORM(),
                    LectorPasivosORM(), notificador,
                    solicitud_id=str(solicitud_id), actor_cedula=cedula_de_sesion(request), ahora=ahora(),
                )
                auditar(
                    request, 'CONSTANCIA_REENVIADA', constancia.numero,
                    nuevo={
                        'solicitud_id': str(solicitud_id),
                        'destinatario': reenvio_res['destinatario'],
                        'copia': reenvio_res['copia'],
                        'reenvios_hoy': reenvio_res['reenvios_hoy'],
                    },
                    recurso_tipo='ConstanciaFeDeVida',
                )

        respuesta = {
            'numero': constancia.numero,
            'plantilla_version': constancia.plantilla_version,
            'reenviado': reenviar,
            'destinatario_enmascarado': reenvio_res['destinatario_enmascarado'] if reenvio_res else None,
            'copia_enmascarada': reenvio_res['copia_enmascarada'] if reenvio_res else None,
            'reenvios_hoy': reenvio_res['reenvios_hoy'] if reenvio_res else None,
        }
        msg = 'Constancia regenerada exitosamente.'
        if reenviar and reenvio_res:
            msg += f" Reenviada a {reenvio_res['destinatario_enmascarado']}."
        return ok(respuesta, msg)


class ConstanciaBienestarView(APIView):
    permission_classes = permisos.permisos_bienestar(
        permisos.REVISAR, permisos.VER_PANEL, permisos.REGISTRAR_PRESENCIAL,
    )

    @extend_schema(
        tags=TAG, summary='Descargar / Imprimir constancia de fe de vida (PDF)',
        description='Descarga o abre el PDF de la constancia de una solicitud VALIDADA para su impresión física.',
        responses={200: OpenApiTypes.BINARY, **ERRORES},
    )
    def get(self, request, solicitud_id):
        repo_sol = RepoSolicitudesFeDeVidaORM()
        solicitud = repo_sol.obtener(str(solicitud_id))
        if solicitud is None:
            raise NotFoundError("La solicitud de fe de vida no existe.")
        constancia = RepoConstanciasORM().obtener_de_solicitud(solicitud.id)
        if constancia is None or not constancia.clave_pdf:
            raise NotFoundError("La constancia aún no está disponible.")
        auditar(request, 'CONSTANCIA_IMPRESA', str(solicitud_id), None, {'numero': constancia.numero})
        respuesta = respuesta_archivo(SeaweedFSStorage(), constancia.clave_pdf, cache='private, no-store')
        respuesta['Content-Disposition'] = f'inline; filename="{NOMBRE_CONSTANCIA}"'
        return respuesta


