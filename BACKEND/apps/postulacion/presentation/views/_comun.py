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
from apps.postulacion.application.use_cases.bandeja import DetalleCaptacion
from apps.postulacion.domain.entities.bandeja import FilaBandeja
from apps.postulacion.domain.entities.psicofisico import ResultadoPsicofisico
from apps.postulacion.domain.services.maquina_estados import (
    P_ABRIR_EXPEDIENTE,
    P_RECHAZAR,
    P_REVISION_FINAL,
    P_VERIFICAR,
    Actor,
)
from core.domain.exceptions import ConflictError, DomainError
from core.infrastructure.models.auditoria import AuditoriaLog
from core.infrastructure.providers import obtener_lector_configuracion
from core.presentation.permissions import usuario_tiene_permiso
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


# --- Captación: actor, errores con código y serialización de la bandeja y el detalle (D-7, D-8) ---
PERMISOS_DE_CAPTACION = (P_VERIFICAR, P_RECHAZAR, P_ABRIR_EXPEDIENTE, P_REVISION_FINAL)
CODIGO_POR_ERROR = {'NotFoundError': 'NO_ENCONTRADO', 'ValidationError': 'DATOS_INVALIDOS',
                    'PermissionDeniedError': 'SIN_PERMISO', 'ConflictError': 'CONFLICTO'}


def actor_de_captacion(request) -> Actor:
    """El usuario autenticado con SUS permisos de Captación; la máquina de estados decide lo demás."""
    user = request.user
    permisos = frozenset(p for p in PERMISOS_DE_CAPTACION if usuario_tiene_permiso(user, p))
    return Actor(cedula=str(getattr(user, 'cedula_id', '') or ''), permisos=permisos)


class ErroresConCodigoMixin:
    """Agrega `data.codigo` (estable, en mayúsculas) a los errores de dominio; el texto sigue en `message`."""

    def handle_exception(self, exc):
        respuesta = super().handle_exception(exc)
        if isinstance(exc, DomainError) and isinstance(getattr(respuesta, 'data', None), dict):
            codigo = getattr(exc, 'codigo', None) or CODIGO_POR_ERROR.get(type(exc).__name__, 'ERROR')
            respuesta.data['data'] = {**(respuesta.data.get('data') or {}), 'codigo': codigo}
        return respuesta


def a_dict_fila_bandeja(f: FilaBandeja) -> dict:
    exp, p = f.expediente, f.postulante
    return {
        'id': exp.id, 'numero': exp.numero, 'estado': exp.estado.value, 'ventana': exp.ventana,
        'vence_el': exp.ventana_vence_el, 'ultimo_cambio': f.ultimo_cambio, 'es_reingreso': f.es_reingreso,
        'pendiente_de_captacion': f.pendiente_de_captacion,
        'postulante': {'cedula': p.cedula, 'nombres': p.nombres, 'apellidos': p.apellidos},
    }


def a_dict_psicofisico(r: ResultadoPsicofisico | None) -> dict | None:
    if r is None:
        return None
    return {
        'resultado': r.resultado, 'fecha_aplicacion': r.fecha_aplicacion, 'observaciones': r.observaciones,
        'tiene_informe': r.tiene_informe, 'informe_tamano': r.informe_tamano, 'registrado_por': r.registrado_por,
        'registrado_el': r.registrado_el, 'sugiere_rechazo': r.sugiere_rechazo,
    }


def a_dict_detalle_captacion(d: DetalleCaptacion) -> dict:
    exp, p = d.base.expediente, d.base.postulante
    return {
        'expediente': {
            **a_dict_expediente_resumen(exp), 'fecha_apertura': exp.fecha_apertura, 'fecha_cierre': exp.fecha_cierre,
            'observaciones': exp.observaciones, 'es_reingreso': p.es_reingreso,
            'propuesta': {
                'cargo_id': exp.cargo_propuesto_id, 'cargo_especifico_id': exp.cargo_especifico_propuesto_id,
                'tipo_nomina_id': exp.tipo_nomina_propuesto_id, 'direccion_general_id': exp.direccion_general_id,
                'direccion_linea_id': exp.direccion_linea_id, 'coordinacion_id': exp.coordinacion_id,
                'dependencia_id': exp.dependencia_id, 'cargo_texto': exp.cargo_propuesto_texto,
                'oficina_texto': exp.oficina_propuesta_texto,
            },
        },
        'postulante': {
            'id': p.id, 'cedula': p.cedula, 'nombres': p.nombres, 'apellidos': p.apellidos, 'correo': p.correo,
            'telefono_movil': p.telefono_movil, 'es_reingreso': p.es_reingreso,
        },
        'datos_ventana1': exp.datos_ventana1,
        'historial': [
            {'estado_origen': t.estado_origen, 'estado_destino': t.estado_destino, 'fecha': t.fecha,
             'actor_cedula': t.actor_cedula, 'actor_tipo': t.actor_tipo, 'motivo': t.motivo}
            for t in d.base.transiciones
        ],
        'psicofisico': {**(a_dict_psicofisico(d.psicofisico) or {}), 'obligatorio': d.psicofisico_obligatorio}
        if d.psicofisico else {'obligatorio': d.psicofisico_obligatorio, 'resultado': None},
        'acciones': [
            {'destino': a.destino, 'etiqueta': a.etiqueta, 'requiere_motivo': a.requiere_motivo,
             'requiere_propuesta': a.requiere_propuesta, 'bloqueada': a.bloqueada,
             'motivo_bloqueo': a.motivo_bloqueo, 'sugerida': a.sugerida}
            for a in d.acciones
        ],
    }
