"""Ayudas compartidas por las vistas de postulación: errores con código, reloj, auditoría y serialización."""
import logging
import uuid
from datetime import datetime, timezone

from rest_framework.views import APIView

from apps.postulacion.application.use_cases.credenciales import EmisionCredencial
from apps.postulacion.application.use_cases.mi_expediente import VistaMiExpediente
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.errores import CredencialBloqueada, ErrorAccesoPostulante
from apps.postulacion.presentation.authentication import PostulanteJWTAuthentication
from apps.postulacion.presentation.permissions.postulante_permissions import ClaveAlDia, EsPostulante
from core.domain.exceptions import ConflictError
from core.infrastructure.models.auditoria import AuditoriaLog
from core.infrastructure.providers import obtener_lector_configuracion
from core.presentation.audit import origen_de_peticion, registrar_auditoria
from core.presentation.envelope import fail
from core.presentation.ip_cliente import ip_del_cliente

MODULO_AUDITORIA = 'postulacion'
RECURSO_EXPEDIENTE = 'ExpedientePostulacion'
ROL_POSTULANTE = 'POSTULANTE'
logger_seguridad = logging.getLogger('security_backend')

# Estado HTTP de cada código de error de acceso (el dominio no conoce HTTP).
ESTADO_HTTP_POR_CODIGO = {
    'CREDENCIALES_INVALIDAS': 401,
    'SESION_INVALIDA': 401,
    'CREDENCIAL_BLOQUEADA': 429,
    'CREDENCIAL_VENCIDA': 403,
    'ACCESO_NO_DISPONIBLE': 403,
    'CAMBIO_CLAVE_OBLIGATORIO': 403,
}


def ahora() -> datetime:
    return datetime.now(timezone.utc)


def configuracion():
    lector = obtener_lector_configuracion()
    if lector is None:
        raise ConflictError("Los parámetros del sistema no están disponibles; intente de nuevo en unos minutos.")
    return lector


def validar_entrada(serializer_cls, data):
    serializer = serializer_cls(data=data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


def respuesta_error_acceso(exc: ErrorAccesoPostulante):
    """Sobre C-1 con el código estable en `data.codigo` (y `bloqueada_hasta` si aplica)."""
    estado = ESTADO_HTTP_POR_CODIGO.get(exc.codigo, 403)
    datos: dict = {'codigo': exc.codigo}
    if isinstance(exc, CredencialBloqueada) and exc.bloqueada_hasta:
        datos['bloqueada_hasta'] = exc.bloqueada_hasta.isoformat()
    if exc.campo:
        datos['errores'] = {exc.campo: [str(exc)]}
    respuesta = fail(str(exc), estado, datos)
    if estado == 401:
        respuesta['WWW-Authenticate'] = 'Bearer realm="postulacion"'
    return respuesta


class ErroresAccesoMixin:
    """Traduce los `ErrorAccesoPostulante` (incluso los de autenticación y permisos) al sobre con código."""

    def handle_exception(self, exc):
        if isinstance(exc, ErrorAccesoPostulante):
            return respuesta_error_acceso(exc)
        return super().handle_exception(exc)


class VistaPostulante(ErroresAccesoMixin, APIView):
    """
    Base de las vistas del postulante. Autenticación EXCLUSIVA de la sesión de invitado (Bearer): ni la cookie
    `dj_access` ni el JWT de un empleado sirven aquí. Exige sesión de postulante y la contraseña ya cambiada.
    """

    authentication_classes = [PostulanteJWTAuthentication]
    permission_classes = [EsPostulante, ClaveAlDia]


def sin_cache(respuesta):
    respuesta['Cache-Control'] = 'no-store'
    respuesta['Pragma'] = 'no-cache'
    return respuesta


def auditar_postulante(request, accion: str, cedula: str, recurso_id: str, nuevo: dict | None = None,
                       resultado: str = AuditoriaLog.Resultado.SUCCESS) -> None:
    registrar_auditoria(
        trace_id=getattr(request, 'trace_id', None) or uuid.uuid4().hex, actor_id=None, actor_cedula=cedula,
        actor_rol=ROL_POSTULANTE, accion=accion, modulo=MODULO_AUDITORIA, recurso_tipo=RECURSO_EXPEDIENTE,
        recurso_id=str(recurso_id), estado_nuevo=nuevo, resultado=resultado, **origen_de_peticion(request),
    )


def auditar_captacion(request, accion: str, recurso_id: str, nuevo: dict | None = None) -> None:
    """Auditoría de las acciones del personal. `nuevo` NUNCA lleva la contraseña temporal."""
    user = request.user
    rol = getattr(getattr(user, 'rol', None), 'nombre_rol', '') or ''
    registrar_auditoria(
        trace_id=getattr(request, 'trace_id', None) or uuid.uuid4().hex, actor_id=getattr(user, 'pk', None),
        actor_cedula=str(getattr(user, 'cedula_id', '') or ''), actor_rol=rol, accion=accion,
        modulo=MODULO_AUDITORIA, recurso_tipo=RECURSO_EXPEDIENTE, recurso_id=str(recurso_id), estado_nuevo=nuevo,
        **origen_de_peticion(request),
    )


def registrar_rechazo(request, exc: ErrorAccesoPostulante, cedula: str) -> None:
    """Rastro de seguridad de un acceso rechazado (nunca la contraseña)."""
    logger_seguridad.warning(
        'postulante.acceso_rechazado codigo=%s cedula=%s ip=%s', exc.codigo, cedula, ip_del_cliente(request),
    )


def a_dict_expediente_resumen(exp: ExpedientePostulacion) -> dict:
    return {
        'id': exp.id, 'numero': exp.numero, 'estado': exp.estado.value, 'ventana': exp.ventana,
        'vence_el': exp.ventana_vence_el,
    }


def a_dict_mi_expediente(v: VistaMiExpediente) -> dict:
    exp, p = v.expediente, v.postulante
    return {
        'expediente': {
            **a_dict_expediente_resumen(exp), 'observaciones': exp.observaciones, 'fecha_apertura': exp.fecha_apertura,
            'ultima_observacion': (
                {'motivo': v.ultima_observacion.motivo, 'fecha': v.ultima_observacion.fecha}
                if v.ultima_observacion else None
            ),
        },
        'postulante': {
            'cedula': p.cedula, 'nombres': p.nombres, 'apellidos': p.apellidos, 'correo': p.correo,
            'telefono_movil': p.telefono_movil,
        },
        'datos_ventana1': exp.datos_ventana1,
        'campos_pendientes': v.campos_pendientes,
    }


def a_dict_credencial(emision: EmisionCredencial) -> dict:
    c = emision.credencial
    return {
        'usuario': c.usuario, 'clave_temporal': emision.clave_temporal, 'ventana': c.ventana, 'vence_el': c.vence_el,
        'debe_cambiar_clave': c.debe_cambiar_clave,
    }
