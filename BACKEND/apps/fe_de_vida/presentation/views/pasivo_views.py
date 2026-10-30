"""
Vistas del PASIVO (C5): proceso vigente, su solicitud e historial, borrador, foto, envío y constancia.
Zero-IDOR: la cédula sale de la sesión; toda operación sobre una solicitud verifica que sea la propia.
Todas exigen el permiso `fe_de_vida.*` Y la condición PASIVO calculada en el servidor.
"""
from django.db import transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.views import APIView

from apps.fe_de_vida.application.use_cases.consultas import (
    listar_mis_solicitudes,
    obtener_mi_constancia,
    obtener_mi_solicitud,
    obtener_proceso_vigente,
)
from apps.fe_de_vida.application.use_cases.solicitudes_pasivo import (
    enviar_solicitud,
    guardar_borrador,
    iniciar_solicitud_vigente,
    subir_evidencia,
)
from apps.fe_de_vida.infrastructure.adaptadores_autogestion import RepoCambiosActaORM, ValidadorCambiosActaORM
from apps.fe_de_vida.infrastructure.imagen_evidencia import sanear_imagen
from apps.fe_de_vida.infrastructure.repositories.repo_constancias_orm import RepoConstanciasORM
from apps.fe_de_vida.infrastructure.repositories.repo_procesos_orm import RepoProcesosORM
from apps.fe_de_vida.infrastructure.repositories.repo_solicitudes_orm import RepoSolicitudesFeDeVidaORM
from apps.fe_de_vida.infrastructure.signals import PublicadorSenales
from apps.fe_de_vida.infrastructure.verificador_pasivo import VerificadorPasivoKernel
from apps.fe_de_vida.presentation.permissions.fe_de_vida_permissions import (
    SOLICITAR,
    VER_PROPIA,
    permisos_pasivo,
)
from apps.fe_de_vida.presentation.serializers.fe_de_vida_serializers import (
    DetalleSolicitudSerializer,
    FiltroHistorialSerializer,
    GuardarBorradorSerializer,
    ProcesoVigenteSerializer,
    SolicitudSerializer,
    SubirEvidenciaSerializer,
    a_cambio_acta,
    a_dict_detalle,
    a_dict_solicitud,
    a_dict_vigente,
)
from apps.fe_de_vida.presentation.views._comun import (
    ahora,
    auditar,
    cedula_de_sesion,
    parametros_pagina,
    respuesta_pagina,
    resumen,
    validar_entrada,
)
from core.domain.exceptions import ValidationError
from core.infrastructure.models.auditoria import AuditoriaLog
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from core.infrastructure.storage.validacion_archivo import MAX_BYTES_FOTO, TIPOS_FOTO, validar_archivo
from core.presentation.archivos import respuesta_archivo
from core.presentation.envelope import ok
from core.presentation.schema import MensajeRespuestaSerializer

TAG = ['Fe de vida · Pasivo']
ERRORES = {400: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer, 404: MensajeRespuestaSerializer,
           409: MensajeRespuestaSerializer}
NOMBRE_CONSTANCIA = 'constancia-fe-de-vida.pdf'


class ProcesoVigenteView(APIView):
    permission_classes = permisos_pasivo(SOLICITAR)

    @extend_schema(
        tags=TAG, summary='Proceso de fe de vida vigente para mí y mi solicitud en él',
        description='`data` es null si no hay proceso disponible. `puede_enviar` considera el plazo y las prórrogas.',
        responses={200: ProcesoVigenteSerializer, 403: MensajeRespuestaSerializer},
    )
    def get(self, request):
        cedula = cedula_de_sesion(request)
        vigente = obtener_proceso_vigente(RepoProcesosORM(), RepoSolicitudesFeDeVidaORM(), cedula=cedula, ahora=ahora())
        return ok(a_dict_vigente(vigente) if vigente else None)


class IniciarSolicitudView(APIView):
    permission_classes = permisos_pasivo(SOLICITAR)

    @extend_schema(
        tags=TAG, summary='Iniciar mi solicitud en el proceso vigente (idempotente)',
        responses={200: SolicitudSerializer, **ERRORES},
    )
    def post(self, request):
        cedula = cedula_de_sesion(request)
        with transaction.atomic():
            solicitud = iniciar_solicitud_vigente(
                RepoProcesosORM(), RepoSolicitudesFeDeVidaORM(), VerificadorPasivoKernel(), cedula=cedula, ahora=ahora(),
            )
            auditar(request, 'SOLICITUD_INICIADA', solicitud.id, None, resumen(solicitud))
        return ok(a_dict_solicitud(solicitud), 'Solicitud de fe de vida iniciada.')


class MisSolicitudesView(APIView):
    permission_classes = permisos_pasivo(VER_PROPIA)

    @extend_schema(
        tags=TAG, summary='Mi historial de fe de vida (una solicitud por proceso)',
        parameters=[OpenApiParameter('estado', str), OpenApiParameter('limit', int, description='Por defecto 10, máximo 50'),
                    OpenApiParameter('offset', int)],
        responses={200: SolicitudSerializer(many=True), 400: MensajeRespuestaSerializer},
    )
    def get(self, request):
        filtros = validar_entrada(FiltroHistorialSerializer, request.query_params)
        limite, desplazamiento = parametros_pagina(filtros)
        solicitudes, total = listar_mis_solicitudes(
            RepoSolicitudesFeDeVidaORM(), cedula=cedula_de_sesion(request), estado=filtros.get('estado'),
            limite=limite, desplazamiento=desplazamiento,
        )
        return ok(respuesta_pagina(total, filtros, [a_dict_solicitud(s) for s in solicitudes]))


class MiSolicitudView(APIView):
    permission_classes = permisos_pasivo(VER_PROPIA)

    @extend_schema(tags=TAG, summary='Detalle de mi solicitud con las respuestas del acta',
                   responses={200: DetalleSolicitudSerializer, 403: MensajeRespuestaSerializer, 404: MensajeRespuestaSerializer})
    def get(self, request, solicitud_id):
        detalle = obtener_mi_solicitud(
            RepoSolicitudesFeDeVidaORM(), RepoCambiosActaORM(), solicitud_id=str(solicitud_id),
            cedula=cedula_de_sesion(request),
        )
        return ok(a_dict_detalle(detalle))


class BorradorView(APIView):
    permission_classes = permisos_pasivo(SOLICITAR)

    @extend_schema(
        tags=TAG, summary='Guardar el borrador del acta (reemplaza mis respuestas)',
        request=GuardarBorradorSerializer, responses={200: DetalleSolicitudSerializer, **ERRORES},
    )
    def put(self, request, solicitud_id):
        cambios = [a_cambio_acta(c) for c in validar_entrada(GuardarBorradorSerializer, request.data)['cambios']]
        cedula = cedula_de_sesion(request)
        with transaction.atomic():
            guardar_borrador(
                RepoProcesosORM(), RepoSolicitudesFeDeVidaORM(), RepoCambiosActaORM(), ValidadorCambiosActaORM(),
                solicitud_id=str(solicitud_id), cedula=cedula, cambios=cambios, ahora=ahora(),
            )
            auditar(request, 'BORRADOR_GUARDADO', str(solicitud_id), None, {'cambios': len(cambios)})
        detalle = obtener_mi_solicitud(
            RepoSolicitudesFeDeVidaORM(), RepoCambiosActaORM(), solicitud_id=str(solicitud_id), cedula=cedula,
        )
        return ok(a_dict_detalle(detalle), 'Borrador guardado.')


class EvidenciaView(APIView):
    permission_classes = permisos_pasivo(SOLICITAR)
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=TAG, summary='Subir la foto con mi cédula (cámara o archivo)',
        description='multipart: `file` (JPG/PNG), `origen` (CAMARA|ARCHIVO) y `metadatos` opcional. Se valida la firma '
                    'real de bytes y el tamaño, y se re-codifica para quitar EXIF/GPS. Reemplaza la foto vigente.',
        request=SubirEvidenciaSerializer, responses={200: SolicitudSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        datos = validar_entrada(SubirEvidenciaSerializer, request.data)
        try:
            contenido, tipo, _ext = validar_archivo(datos['file'], TIPOS_FOTO, MAX_BYTES_FOTO)
            contenido = sanear_imagen(contenido, tipo.mime)
        except ValidationError as exc:
            auditar(request, 'EVIDENCIA_RECHAZADA_POR_CALIDAD', str(solicitud_id), None, {'motivo': str(exc)},
                    resultado=AuditoriaLog.Resultado.FAILED)
            raise
        cedula = cedula_de_sesion(request)
        with transaction.atomic():
            solicitud = subir_evidencia(
                RepoProcesosORM(), RepoSolicitudesFeDeVidaORM(), SeaweedFSStorage(), solicitud_id=str(solicitud_id),
                cedula=cedula, contenido=contenido, mime=tipo.mime, origen=datos['origen'],
                metadatos=datos.get('metadatos'), ahora=ahora(),
            )
            auditar(request, 'EVIDENCIA_SUBIDA', solicitud.id, None,
                    {**resumen(solicitud), 'origen': datos['origen'], 'sha256': solicitud.evidencia_sha256,
                     'tamano': solicitud.evidencia_tamano})
        return ok(a_dict_solicitud(solicitud), 'Foto cargada.')


class EnviarView(APIView):
    permission_classes = permisos_pasivo(SOLICITAR)

    @extend_schema(
        tags=TAG, summary='Enviar mi fe de vida a Bienestar Social',
        description='Exige la foto y un proceso abierto (o prórroga vigente). Tras una repetición solicitada, es el reenvío.',
        request=None, responses={200: SolicitudSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        cedula = cedula_de_sesion(request)
        with transaction.atomic():
            solicitud = enviar_solicitud(
                RepoProcesosORM(), RepoSolicitudesFeDeVidaORM(), PublicadorSenales(),
                solicitud_id=str(solicitud_id), cedula=cedula, ahora=ahora(),
            )
            auditar(request, 'SOLICITUD_ENVIADA', solicitud.id, None, resumen(solicitud))
        return ok(a_dict_solicitud(solicitud), 'Fe de vida enviada a Bienestar Social.')


class MiConstanciaView(APIView):
    permission_classes = permisos_pasivo(VER_PROPIA)

    @extend_schema(tags=TAG, summary='Descargar mi constancia de fe de vida (PDF)',
                   responses={200: OpenApiTypes.BINARY, 403: MensajeRespuestaSerializer, 404: MensajeRespuestaSerializer})
    def get(self, request, solicitud_id):
        constancia = obtener_mi_constancia(
            RepoSolicitudesFeDeVidaORM(), RepoConstanciasORM(), solicitud_id=str(solicitud_id),
            cedula=cedula_de_sesion(request),
        )
        auditar(request, 'CONSTANCIA_DESCARGADA', str(solicitud_id), None, {'numero': constancia.numero})
        respuesta = respuesta_archivo(SeaweedFSStorage(), constancia.clave_pdf, cache='private, no-store')
        respuesta['Content-Disposition'] = f'attachment; filename="{NOMBRE_CONSTANCIA}"'
        return respuesta
