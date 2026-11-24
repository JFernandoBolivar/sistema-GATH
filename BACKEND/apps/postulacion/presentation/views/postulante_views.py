"""Vistas del postulante (invitado): acceso, cambio de clave, su expediente, borrador y envío (D-4)."""
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from django.http import HttpResponse
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.postulacion.application.use_cases.credenciales import autenticar_postulante, cambiar_clave
from apps.postulacion.application.use_cases.documentos_expediente import (
    firmar_mi_documento,
    guardar_mis_campos,
    listar_mis_documentos,
    mi_documento_firmado,
    ver_mi_planilla,
)
from apps.postulacion.application.use_cases.enlace_activacion import activar_con_enlace, consultar_enlace
from apps.postulacion.application.use_cases.mi_expediente import (
    consultar_mi_expediente,
    enviar_expediente,
    guardar_borrador,
)
from apps.postulacion.application.use_cases.ventana2 import (
    VistaVentana2,
    consultar_ventana2,
    foto_propia,
    guardar_ventana2,
    subir_foto,
)
from apps.postulacion.domain.errores import ErrorAccesoPostulante
from apps.postulacion.domain.services.credencial import expiracion_sesion
from apps.postulacion.infrastructure.catalogos_ventana2_orm import CatalogosVentana2ORM
from apps.postulacion.infrastructure.documentos_expediente_orm import DocumentosExpedienteORM
from apps.postulacion.infrastructure.foto_carnet import preparar_foto_carnet
from apps.postulacion.infrastructure.hasheador_django import HasheadorDjango
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import RepoPostulacionORM
from apps.postulacion.infrastructure.tokens.sesion_invitado import emitir_token_invitado
from apps.postulacion.presentation.authentication import PostulanteJWTAuthentication
from apps.postulacion.presentation.permissions.postulante_permissions import EsPostulante
from apps.postulacion.presentation.serializers.postulacion_serializers import (
    AccesoSerializer,
    ActivarEnlaceSerializer,
    EnlaceValidoSerializer,
    BorradorSerializer,
    CambiarClaveSerializer,
    DocumentoCamposSerializer,
    EnvioSerializer,
    FirmarDocumentoSerializer,
    FotoCarnetSerializer,
    MiExpedienteSerializer,
    SesionInvitadoSerializer,
    Ventana2RespuestaSerializer,
    Ventana2Serializer,
)
from apps.postulacion.presentation.views._comun import (
    ErroresAccesoMixin,
    VistaPostulante,
    a_dict_expediente_resumen,
    a_dict_mi_expediente,
    ahora,
    auditar_postulante,
    configuracion,
    registrar_rechazo,
    sin_cache,
    validar_entrada,
)
from core.infrastructure.providers import obtener_notificador
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from core.presentation.archivos import respuesta_archivo
from core.presentation.envelope import ok
from core.presentation.ip_cliente import ip_del_cliente
from core.presentation.schema import MensajeRespuestaSerializer

TAG = ['Postulación · Postulante']
ERRORES = {
    400: MensajeRespuestaSerializer, 401: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer,
    404: MensajeRespuestaSerializer, 409: MensajeRespuestaSerializer, 429: MensajeRespuestaSerializer,
}


def _sesion(credencial, expediente, momento) -> dict:
    """Respuesta con el token de invitado (≤ 2 h y nunca más allá del vencimiento de la credencial)."""
    expira = expiracion_sesion(credencial, momento)
    token = emitir_token_invitado(
        cedula=credencial.usuario, expediente_id=expediente.id, version_sesion=credencial.version_sesion,
        ahora=momento, expira_el=expira,
    )
    return {
        'token': token, 'tipo': 'Bearer', 'scope': f'expediente:{expediente.id}', 'expira_el': expira,
        'expira_en_segundos': max(0, int((expira - momento).total_seconds())),
        'debe_cambiar_clave': credencial.debe_cambiar_clave, 'expediente': a_dict_expediente_resumen(expediente),
    }


class AccesoView(ErroresAccesoMixin, APIView):
    """Cédula + contraseña -> sesión de invitado. Sin autenticación previa; con throttle por IP y bloqueo por credencial."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_scope = 'login'

    @extend_schema(
        tags=TAG, summary='Acceso del postulante (sesión de invitado)', request=AccesoSerializer,
        description=(
            "Devuelve un JWT de invitado propio (≤ 2 h, ligado al expediente, `scope=expediente:<id>`) que SOLO sirve "
            "en las rutas del postulante. 5 intentos fallidos bloquean 15 minutos (429). Si es la primera entrada "
            "con el expediente PRE_REGISTRADO, pasa a EN_CAPTURA."
        ),
        responses={200: SesionInvitadoSerializer, **ERRORES},
    )
    def post(self, request):
        datos = validar_entrada(AccesoSerializer, request.data)
        cedula = datos['cedula'].strip()
        momento = ahora()
        try:
            acceso = autenticar_postulante(
                RepoPostulacionORM(), HasheadorDjango(), configuracion(),
                cedula=cedula, clave=datos['password'], ahora=momento,
            )
        except ErrorAccesoPostulante as exc:
            registrar_rechazo(request, exc, cedula)
            raise
        auditar_postulante(
            request, 'POSTULANTE_ACCESO', acceso.credencial.usuario, acceso.expediente.id,
            {'estado': acceso.expediente.estado.value, 'ventana': acceso.credencial.ventana,
             'primer_acceso': acceso.primer_acceso},
        )
        return sin_cache(ok(_sesion(acceso.credencial, acceso.expediente, momento), 'Acceso concedido.'))


class ActivarEnlaceView(ErroresAccesoMixin, APIView):
    """
    Enlace de activación enviado por correo (D-10). Público, con throttle por IP (`login`) y bloqueo del enlace tras 5
    cédulas equivocadas. Los errores llevan `data.codigo`: ENLACE_INVALIDO (404), ENLACE_VENCIDO y ENLACE_USADO (410),
    ENLACE_BLOQUEADO (403) y ACTIVACION_DATOS_INCORRECTOS (400, mensaje genérico).
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_scope = 'login'

    @extend_schema(
        tags=TAG, summary='Validar el enlace de activación (sin consumirlo)',
        parameters=[OpenApiParameter('t', str, required=True, description='Token del enlace.')],
        responses={200: EnlaceValidoSerializer, **ERRORES},
    )
    def get(self, request):
        token = (request.query_params.get('t') or '').strip()
        try:
            enlace, numero = consultar_enlace(RepoPostulacionORM(), token=token, ahora=ahora())
        except ErrorAccesoPostulante as exc:
            registrar_rechazo(request, exc, '')
            raise
        return sin_cache(ok({'valido': True, 'numero': numero, 'vence_el': enlace.vence_el}))

    @extend_schema(
        tags=TAG, summary='Activar el acceso: cédula + contraseña nueva (un solo uso)', request=ActivarEnlaceSerializer,
        description=(
            "Comprueba la cédula (segundo factor), fija la contraseña, marca el enlace como usado y devuelve la MISMA sesión de "
            "invitado que el acceso (`debe_cambiar_clave` = false). Reglas de la contraseña: las del cambio de clave."
        ),
        responses={200: SesionInvitadoSerializer, **ERRORES},
    )
    def post(self, request):
        datos = validar_entrada(ActivarEnlaceSerializer, request.data)
        cedula = datos['cedula'].strip()
        momento = ahora()
        try:
            acceso = activar_con_enlace(
                RepoPostulacionORM(), HasheadorDjango(), configuracion(), token=datos['token'], cedula=cedula,
                clave_nueva=datos['clave_nueva'], ip=ip_del_cliente(request), ahora=momento,
            )
        except ErrorAccesoPostulante as exc:
            registrar_rechazo(request, exc, cedula)
            raise
        # La auditoría guarda la IP de uso (origen de la petición) y nunca el token ni la contraseña.
        auditar_postulante(
            request, 'POSTULANTE_ENLACE_USADO', acceso.credencial.usuario, acceso.expediente.id,
            {'estado': acceso.expediente.estado.value, 'ventana': acceso.credencial.ventana,
             'primer_acceso': acceso.primer_acceso},
        )
        return sin_cache(ok(_sesion(acceso.credencial, acceso.expediente, momento), 'Contraseña creada.'))


class CambiarClaveView(ErroresAccesoMixin, APIView):
    """
    Cambio de la contraseña temporal. Es la única ruta autenticada que NO exige la clave al día (es justo la que
    la deja al día). Devuelve una sesión nueva: las demás sesiones abiertas dejan de valer.
    """

    authentication_classes = [PostulanteJWTAuthentication]
    permission_classes = [EsPostulante]
    throttle_scope = 'login'

    @extend_schema(
        tags=TAG, summary='Cambiar la contraseña (obligatorio en el primer ingreso)', request=CambiarClaveSerializer,
        responses={200: SesionInvitadoSerializer, **ERRORES},
    )
    def post(self, request):
        datos = validar_entrada(CambiarClaveSerializer, request.data)
        sesion = request.user
        momento = ahora()
        repo = RepoPostulacionORM()
        credencial = cambiar_clave(
            repo, HasheadorDjango(), expediente_id=sesion.expediente_id, cedula=sesion.cedula,
            clave_actual=datos['clave_actual'], clave_nueva=datos['clave_nueva'], ahora=momento,
        )
        vista = consultar_mi_expediente(repo, expediente_id=sesion.expediente_id, cedula=sesion.cedula)
        auditar_postulante(request, 'POSTULANTE_CLAVE_CAMBIADA', sesion.cedula, sesion.expediente_id)
        return sin_cache(ok(_sesion(credencial, vista.expediente, momento), 'Contraseña actualizada.'))


class MiExpedienteView(VistaPostulante):
    @extend_schema(
        tags=TAG, summary='Mi expediente: estado, ventana, vencimiento y observaciones',
        responses={200: MiExpedienteSerializer, **ERRORES},
    )
    def get(self, request):
        sesion = request.user
        vista = consultar_mi_expediente(
            RepoPostulacionORM(), expediente_id=sesion.expediente_id, cedula=sesion.cedula,
            documentos=DocumentosExpedienteORM(),
        )
        return sin_cache(ok(a_dict_mi_expediente(vista)))


class BorradorView(VistaPostulante):
    @extend_schema(
        tags=TAG, summary='Guardar el borrador de la ventana actual', request=BorradorSerializer,
        responses={200: MiExpedienteSerializer, **ERRORES},
    )
    def put(self, request):
        datos = validar_entrada(BorradorSerializer, request.data)
        sesion = request.user
        repo = RepoPostulacionORM()
        guardar_borrador(
            repo, configuracion(), expediente_id=sesion.expediente_id, cedula=sesion.cedula,
            nombres=datos['nombres'], apellidos=datos['apellidos'], correo=datos.get('correo'),
            telefono_movil=datos.get('telefono_movil'), datos_ventana1=datos.get('datos_ventana1'),
            ahora=ahora(),
        )
        vista = consultar_mi_expediente(repo, expediente_id=sesion.expediente_id, cedula=sesion.cedula)
        return sin_cache(ok(a_dict_mi_expediente(vista), 'Borrador guardado.'))


class EnviarView(VistaPostulante):
    @extend_schema(
        tags=TAG, summary='Enviar la ventana actual a Captación', request=None,
        description=(
            "EN_CAPTURA o EN_CORRECCION_DATOS -> ENVIADO_CAPTACION; CONSOLIDANDO -> EN_REVISION_FINAL. "
            "La sesión se cierra: el token deja de valer al enviar. Ventana 2 incompleta: 400 con `data.codigo` = "
            "VENTANA2_INCOMPLETA y `data.faltantes` = `[{seccion, campo, mensaje}]` (incluye la foto)."
        ),
        responses={200: EnvioSerializer, **ERRORES},
    )
    def post(self, request):
        sesion = request.user
        repo = RepoPostulacionORM()
        enviar_expediente(
            repo, configuracion(), expediente_id=sesion.expediente_id, cedula=sesion.cedula, ahora=ahora(),
            notificador=obtener_notificador(), catalogos=CatalogosVentana2ORM(), documentos=DocumentosExpedienteORM(),
        )
        vista = consultar_mi_expediente(repo, expediente_id=sesion.expediente_id, cedula=sesion.cedula)
        auditar_postulante(
            request, 'POSTULANTE_ENVIO', sesion.cedula, sesion.expediente_id,
            {'estado': vista.expediente.estado.value},
        )
        return sin_cache(ok(
            {'sesion_cerrada': True, 'expediente': a_dict_mi_expediente(vista)['expediente']},
            'Expediente enviado a Captación.',
        ))


# ---------------------------------------------------------------------------------------------------------------
# Ventana 2 (G-2): formulario de consolidación y foto de carnet. Solo en CONSOLIDANDO y con la ventana vigente.
# ---------------------------------------------------------------------------------------------------------------
def _dict_ventana2(v: VistaVentana2) -> dict:
    exp = v.expediente
    return {
        'expediente': a_dict_expediente_resumen(exp), 'datos_ventana2': v.datos, 'faltantes': v.faltantes,
        'completa': v.completa,
        'foto': {'tiene': exp.tiene_foto, 'subida_el': exp.foto_subida_el, 'tamano': exp.foto_tamano},
    }


class Ventana2View(VistaPostulante):
    @extend_schema(
        tags=TAG, summary='Borrador de la Ventana 2 (familiares, vivienda, salud, tallas) y lo que falta',
        responses={200: Ventana2RespuestaSerializer, **ERRORES},
        description=(
            "Solo con el expediente en CONSOLIDANDO y la ventana vigente (otro estado: 409 `VENTANA_INCORRECTA`; ventana "
            "vencida: 403). `faltantes` es lo que aún impide enviar."
        ),
    )
    def get(self, request):
        sesion = request.user
        vista = consultar_ventana2(
            RepoPostulacionORM(), CatalogosVentana2ORM(), expediente_id=sesion.expediente_id, cedula=sesion.cedula,
            ahora=ahora(), documentos=DocumentosExpedienteORM(),
        )
        return sin_cache(ok(_dict_ventana2(vista)))

    @extend_schema(
        tags=TAG, summary='Guardar el borrador de la Ventana 2', request=Ventana2Serializer,
        responses={200: Ventana2RespuestaSerializer, **ERRORES},
        description=(
            "Cada sección enviada (`familiares`, `sin_familiares`, `vivienda`, `salud`, `tallas`) REEMPLAZA a la anterior; las "
            "omitidas no cambian. Todo viaja por id de los catálogos de `ventana2/catalogos/`. Claves desconocidas: 400. "
            "Ids inexistentes o jerarquía geográfica incoherente: 400 `DATOS_INVALIDOS` con `data.errores` = `{ruta: mensaje}`."
        ),
    )
    def put(self, request):
        sesion = request.user
        vista = guardar_ventana2(
            RepoPostulacionORM(), configuracion(), CatalogosVentana2ORM(), expediente_id=sesion.expediente_id,
            cedula=sesion.cedula, datos=request.data, ahora=ahora(), documentos=DocumentosExpedienteORM(),
        )
        return sin_cache(ok(_dict_ventana2(vista), 'Borrador de la Ventana 2 guardado.'))


class Ventana2CatalogosView(VistaPostulante):
    @extend_schema(
        tags=TAG, summary='Catálogos del formulario de la Ventana 2',
        parameters=[
            OpenApiParameter('estado_id', int, description='Devuelve además los municipios de ese estado.'),
            OpenApiParameter('municipio_id', int, description='Devuelve además las parroquias de ese municipio.'),
        ],
        description=(
            "Los MISMOS catálogos del expediente del trabajador: `parentescos` (con la regla de hijo/menor sin cédula), "
            "`sexos`, `condiciones_vivienda`, `estados` (+ `municipios` y `parroquias` en cascada), `grupos_sanguineos`, "
            "`alergias`, `patologias_cronicas`, `discapacidades` y `tallas` (`camisa`, `pantalon`, `calzado`, `chaqueta`)."
        ),
        responses={200: OpenApiTypes.OBJECT, **ERRORES},
    )
    def get(self, request):
        def entero(clave):
            valor = request.query_params.get(clave)
            return int(valor) if valor and valor.isdigit() else None

        return sin_cache(ok(CatalogosVentana2ORM().catalogos(entero('estado_id'), entero('municipio_id'))))


class Ventana2FotoView(VistaPostulante):
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=TAG, summary='Mi foto de carnet (binario)', responses={200: OpenApiTypes.BINARY, **ERRORES},
        description="Solo la del propio expediente de la sesión. Sin caché. 404 si todavía no subió ninguna.",
    )
    def get(self, request):
        sesion = request.user
        clave = foto_propia(
            RepoPostulacionORM(), expediente_id=sesion.expediente_id, cedula=sesion.cedula, ahora=ahora(),
        )
        return respuesta_archivo(
            SeaweedFSStorage(), clave, cache='private, no-store',
            request=request, recurso='foto_postulante', recurso_id=sesion.expediente_id,
        )

    @extend_schema(
        tags=TAG, summary='Subir (o reemplazar) mi foto de carnet', request={'multipart/form-data': FotoCarnetSerializer},
        responses={200: Ventana2RespuestaSerializer, **ERRORES},
        description=(
            "JPEG o PNG (se valida la firma real, no el `Content-Type`), máx. 5 MB, mínimo 300 x 300 px. Se reencodifica sin "
            "metadatos y se guarda con una clave opaca (sin la cédula). Una por expediente: reemplazable mientras siga en CONSOLIDANDO."
        ),
    )
    def post(self, request):
        datos = validar_entrada(FotoCarnetSerializer, request.data)
        sesion = request.user
        repo = RepoPostulacionORM()
        foto = preparar_foto_carnet(datos['foto'])
        subir_foto(
            repo, SeaweedFSStorage(), configuracion(), expediente_id=sesion.expediente_id, cedula=sesion.cedula,
            foto=foto, ahora=ahora(),
        )
        auditar_postulante(request, 'POSTULANTE_FOTO_SUBIDA', sesion.cedula, sesion.expediente_id, {'tamano': len(foto.contenido)})
        vista = consultar_ventana2(
            repo, CatalogosVentana2ORM(), expediente_id=sesion.expediente_id, cedula=sesion.cedula, ahora=ahora(),
            documentos=DocumentosExpedienteORM(),
        )
        return sin_cache(ok(_dict_ventana2(vista), 'Foto de carnet guardada.'))


# ---------------------------------------------------------------------------------------------------------------
# Documentos de la Ventana 2 (F-4, F-5, F-6): campos propios, «Ver mi planilla» y firma por clic de conformidad.
# El postulante solo ve y firma lo de SU expediente (sale de la sesión); `codigo` es el de la plantilla, nunca un id ajeno.
# ---------------------------------------------------------------------------------------------------------------
def _pdf_en_linea(contenido: bytes, nombre: str) -> HttpResponse:
    respuesta = HttpResponse(contenido, content_type='application/pdf')
    respuesta['Content-Disposition'] = f'inline; filename="{nombre}"'
    respuesta['Cache-Control'] = 'private, no-store'
    respuesta['X-Content-Type-Options'] = 'nosniff'
    return respuesta


class Ventana2DocumentosView(VistaPostulante):
    @extend_schema(
        tags=TAG, summary='Mis documentos de la Ventana 2 con su estado',
        description=(
            "Las plantillas ACTIVAS y publicadas de momento «Ventana 2». Cada una trae sus `campos_propios` y mis `valores`, "
            "`faltan` (obligatorios sin llenar), `estado` (`pendiente_datos` | `listo_para_revisar` | `firmado`), `requiere_firma`, "
            "`texto_conformidad`, `firma_invalidada` (estaba firmado y un cambio deshizo la firma) y la evidencia de `firma`."
        ),
        responses={200: OpenApiTypes.OBJECT, **ERRORES},
    )
    def get(self, request):
        sesion = request.user
        return sin_cache(ok(listar_mis_documentos(
            RepoPostulacionORM(), DocumentosExpedienteORM(), expediente_id=sesion.expediente_id, cedula=sesion.cedula,
            ahora=ahora(),
        )))


class Ventana2DocumentoCamposView(VistaPostulante):
    parser_classes = [JSONParser]

    @extend_schema(
        tags=TAG, summary='Guardar los campos propios de un documento', request=DocumentoCamposSerializer,
        responses={200: OpenApiTypes.OBJECT, **ERRORES},
        description=(
            "Reemplaza los valores del documento `codigo`. Valida el tipo de cada campo (texto, texto largo, fecha, sí/no, lista); "
            "los obligatorios pueden quedar vacíos mientras se llena (se exigen al firmar y al enviar). Si el documento estaba "
            "firmado, la firma queda sin efecto: `firma_invalidada` = true y hay que firmar de nuevo."
        ),
    )
    def put(self, request, codigo):
        datos = validar_entrada(DocumentoCamposSerializer, request.data)
        sesion = request.user
        item = guardar_mis_campos(
            RepoPostulacionORM(), configuracion(), DocumentosExpedienteORM(), expediente_id=sesion.expediente_id,
            cedula=sesion.cedula, codigo=codigo, valores=datos['valores'], ahora=ahora(),
        )
        auditar_postulante(request, 'POSTULANTE_DOCUMENTO_CAMPOS', sesion.cedula, sesion.expediente_id, {'documento': codigo})
        if item.get('firma_invalidada'):
            auditar_postulante(request, 'POSTULANTE_DOCUMENTO_FIRMA_INVALIDADA', sesion.cedula, sesion.expediente_id, {'documento': codigo})
        return sin_cache(ok(item, 'Datos del documento guardados.'))


class Ventana2DocumentoVistaPreviaView(VistaPostulante):
    @extend_schema(
        tags=TAG, summary='Ver mi planilla: PDF prellenado con mis datos', responses={(200, 'application/pdf'): OpenApiTypes.BINARY, **ERRORES},
        description="Se genera al momento con mis datos y lo que llevo llenado; no se guarda ni cuenta como firma.",
    )
    def get(self, request, codigo):
        sesion = request.user
        pdf = ver_mi_planilla(
            RepoPostulacionORM(), DocumentosExpedienteORM(), expediente_id=sesion.expediente_id, cedula=sesion.cedula,
            codigo=codigo, ahora=ahora(),
        )
        return _pdf_en_linea(pdf, 'mi_planilla.pdf')


class Ventana2DocumentoFirmarView(VistaPostulante):
    parser_classes = [JSONParser]

    @extend_schema(
        tags=TAG, summary='Firmar un documento con un clic de conformidad', request=FirmarDocumentoSerializer,
        responses={200: OpenApiTypes.OBJECT, **ERRORES},
        description=(
            "Genera el documento final con mis datos de hoy (snapshot y sha256) y registra la firma con fecha, IP, navegador, "
            "huella y el texto de conformidad. Exige `acepto` = true y los campos obligatorios llenos. Ya firmado y vigente: 409."
        ),
    )
    def post(self, request, codigo):
        datos = validar_entrada(FirmarDocumentoSerializer, request.data)
        sesion = request.user
        item = firmar_mi_documento(
            RepoPostulacionORM(), DocumentosExpedienteORM(), expediente_id=sesion.expediente_id, cedula=sesion.cedula,
            codigo=codigo, ip=ip_del_cliente(request), user_agent=request.META.get('HTTP_USER_AGENT', ''),
            acepta=datos['acepto'], ahora=ahora(),
        )
        auditar_postulante(
            request, 'POSTULANTE_DOCUMENTO_FIRMADO', sesion.cedula, sesion.expediente_id,
            {'documento': codigo, 'sha256': (item.get('firma') or {}).get('sha256')},
        )
        return sin_cache(ok(item, 'Documento firmado.'))


class Ventana2DocumentoArchivoView(VistaPostulante):
    @extend_schema(
        tags=TAG, summary='Mi documento firmado (PDF)', responses={(200, 'application/pdf'): OpenApiTypes.BINARY, **ERRORES},
        description="Solo el firmado y vigente de mi propio expediente; 404 si no lo hay. Queda en la bitácora de descargas.",
    )
    def get(self, request, codigo):
        sesion = request.user
        clave, documento_id = mi_documento_firmado(
            RepoPostulacionORM(), DocumentosExpedienteORM(), expediente_id=sesion.expediente_id, cedula=sesion.cedula,
            codigo=codigo, ahora=ahora(),
        )
        return respuesta_archivo(
            SeaweedFSStorage(), clave, cache='private, no-store', mime='application/pdf',
            request=request, recurso='documento_firmado', recurso_id=documento_id,
        )
