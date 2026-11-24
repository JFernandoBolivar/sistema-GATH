"""Ayudas compartidas por las vistas de postulación: errores con código, reloj, auditoría y serialización."""
import logging
import uuid
from datetime import datetime, timezone

from rest_framework.views import APIView

from apps.postulacion.application.use_cases.credenciales import EmisionCredencial
from apps.postulacion.application.use_cases.mi_expediente import VistaMiExpediente
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.errores import CredencialBloqueada, ErrorAccesoPostulante
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import BuscadorEmpleadosORM
from apps.postulacion.presentation.authentication import PostulanteJWTAuthentication
from apps.postulacion.presentation.permissions.postulante_permissions import ClaveAlDia, EsPostulante
from apps.postulacion.application.use_cases.bandeja import DetalleCaptacion
from apps.postulacion.domain.entities.bandeja import FilaBandeja
from apps.postulacion.domain.entities.psicofisico import ResultadoPsicofisico
from apps.postulacion.application.use_cases.presupuesto import DetalleArea, FilaEnriquecida, QuienActua
from apps.postulacion.domain.entities.constancia import ConstanciaPresupuestaria
from apps.postulacion.domain.entities.punto_cuenta_ingreso import PuntoCuentaIngreso
from apps.postulacion.domain.entities.reserva import ReservaPuesto
from apps.postulacion.domain.entities.vacantes import PuestoVacante
from apps.postulacion.domain.services.contacto import contacto_atrasado, contacto_pendiente
from apps.postulacion.domain.services.maquina_estados import (
    P_ABRIR_EXPEDIENTE,
    P_APROBAR_INGRESO,
    P_DECLARAR_DISPONIBILIDAD,
    P_DEVOLVER_SOLICITUD,
    P_EMITIR_PUNTO_CUENTA,
    P_RECHAZAR,
    P_RESERVAR_PUESTO,
    P_REVISION_FINAL,
    P_VER_INGRESOS,
    P_VER_SOLICITUDES,
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
        respuesta = super().handle_exception(exc)
        # Los errores de dominio con `codigo` explícito (p. ej. VENTANA2_INCOMPLETA, VENTANA_INCORRECTA) lo llevan en `data`,
        # con su detalle (la lista de faltantes). Los demás conservan su respuesta de siempre.
        if isinstance(exc, DomainError) and getattr(exc, 'codigo', None) and isinstance(getattr(respuesta, 'data', None), dict):
            respuesta.data['data'] = {
                **(respuesta.data.get('data') or {}), **(getattr(exc, 'detalle', None) or {}), 'codigo': exc.codigo,
            }
        return respuesta


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
        # Qué formulario toca: el frontend muestra el de la Ventana 1 o el de la 2 (con sus datos, faltantes y foto).
        'ventana_actual': exp.ventana,
        'formulario': {1: 'ventana1', 2: 'ventana2'}.get(exp.ventana),
        'datos_ventana2': exp.datos_ventana2 if exp.ventana == 2 else {},
        'tiene_foto': exp.tiene_foto,
        'faltantes_ventana2': v.faltantes_ventana2,
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
            respuesta.data['data'] = {
                **(respuesta.data.get('data') or {}), **(getattr(exc, 'detalle', None) or {}), 'codigo': codigo,
            }
        return respuesta


def a_dict_contacto(exp: ExpedientePostulacion, horas: int, momento: datetime | None = None) -> dict:
    """La tarea «contactar al postulante» (G-1): pendiente, desde cuándo y si ya pasó el plazo de escalamiento."""
    return {
        'contacto_pendiente': contacto_pendiente(exp), 'contacto_pendiente_desde': exp.contacto_pendiente_desde,
        'contacto_atrasado': contacto_atrasado(exp, momento or ahora(), horas),
    }


def a_dict_fila_bandeja(f: FilaBandeja, horas: int = 48, momento: datetime | None = None) -> dict:
    exp, p = f.expediente, f.postulante
    return {
        'id': exp.id, 'numero': exp.numero, 'estado': exp.estado.value, 'ventana': exp.ventana,
        'vence_el': exp.ventana_vence_el, 'ultimo_cambio': f.ultimo_cambio, 'es_reingreso': f.es_reingreso,
        'pendiente_de_captacion': f.pendiente_de_captacion, **a_dict_contacto(exp, horas, momento),
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
            **a_dict_contacto(exp, d.horas_escalamiento_contacto),
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
        'datos_ventana2': exp.datos_ventana2,
        'datos_ventana2_legible': d.ventana2_legible,
        'ventana2_faltantes': d.ventana2_faltantes,
        'foto': {
            'tiene': exp.tiene_foto, 'subida_el': exp.foto_subida_el, 'tamano': exp.foto_tamano,
            'url': f'{RUTA_BASE}/expedientes/{exp.id}/foto/' if exp.tiene_foto else None,
        },
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


# --- Presupuesto y Dirección General (E-1 a E-6) ---
PERMISOS_DE_PRESUPUESTO = (
    P_VER_SOLICITUDES, P_RESERVAR_PUESTO, P_DECLARAR_DISPONIBILIDAD, P_DEVOLVER_SOLICITUD, P_EMITIR_PUNTO_CUENTA,
)
PERMISOS_DE_DIRECCION = (P_VER_INGRESOS, P_APROBAR_INGRESO)
RUTA_BASE = '/api/v1/postulacion'


def actor_con_permisos(request, permisos: tuple[str, ...]) -> Actor:
    """El usuario autenticado con SUS permisos de esa área; la máquina de estados decide con el permiso EXACTO."""
    user = request.user
    return Actor(
        cedula=str(getattr(user, 'cedula_id', '') or ''),
        permisos=frozenset(p for p in permisos if usuario_tiene_permiso(user, p)),
    )


def nombre_del_usuario(user) -> str:
    """Nombre de quien actúa (queda en la constancia y el Punto de Cuenta): el del trabajador asociado a su cuenta."""
    empleado = getattr(user, 'cedula', None)
    nombre = ' '.join(
        str(getattr(empleado, campo, '') or '').strip() for campo in ('nombres', 'apellidos')
    ).strip() if empleado is not None and not isinstance(empleado, (str, int)) else ''
    nombre = nombre or str(getattr(user, 'nombre_completo', '') or '').strip()
    if not nombre:
        # Respaldo: el trabajador con la cédula de la cuenta. Sin esto el Punto de Cuenta decía «emitido por N/A».
        cedula = str(getattr(user, 'cedula_id', '') or '').strip()
        previo = BuscadorEmpleadosORM().por_cedula(cedula) if cedula else None
        if previo is not None:
            nombre = f'{previo.nombres} {previo.apellidos}'.strip()
    return nombre


def quien_actua(request) -> QuienActua:
    user = request.user
    pk = getattr(user, 'pk', None)
    return QuienActua(
        cedula=str(getattr(user, 'cedula_id', '') or ''), nombre=nombre_del_usuario(user),
        usuario_id=pk if isinstance(pk, int) else None,
    )


def a_dict_puesto(p: PuestoVacante | None) -> dict | None:
    if p is None:
        return None
    return {
        'id': p.id, 'codigo': p.codigo, 'vacante': p.vacante,
        'cargo': {'id': p.cargo_id, 'nombre': p.cargo_nombre},
        'cargo_especifico': {'id': p.cargo_especifico_id, 'nombre': p.cargo_especifico_nombre},
        'tipo_nomina': {'id': p.tipo_nomina_id, 'nombre': p.tipo_nomina_nombre},
        'dependencia': {'id': p.dependencia_id, 'nombre': p.dependencia_nombre},
        'direccion_general': {'id': p.direccion_general_id, 'nombre': p.direccion_general_nombre},
        'direccion_linea': {'id': p.direccion_linea_id, 'nombre': p.direccion_linea_nombre},
        'coordinacion': {'id': p.coordinacion_id, 'nombre': p.coordinacion_nombre},
    }


def a_dict_reserva(r: ReservaPuesto | None, puesto: PuestoVacante | None = None, ahora_: datetime | None = None) -> dict | None:
    if r is None:
        return None
    return {
        'id': r.id, 'puesto_id': r.puesto_id, 'estado': r.estado, 'reservado_por': r.reservado_por,
        'reservado_el': r.reservado_el, 'vence_el': r.vence_el, 'vigente': r.vigente(ahora_ or ahora()),
        'puesto': a_dict_puesto(puesto),
    }


def a_dict_constancia(c: ConstanciaPresupuestaria | None) -> dict | None:
    if c is None:
        return None
    return {
        'referencia': c.referencia, 'observaciones': c.observaciones, 'fecha': c.fecha,
        'declarado_por_cedula': c.declarado_por_cedula, 'declarado_por_nombre': c.declarado_por_nombre,
        'tiene_adjunto': c.tiene_adjunto, 'adjunto_tamano': c.adjunto_tamano,
    }


def a_dict_punto_cuenta(pc: PuntoCuentaIngreso | None) -> dict | None:
    if pc is None:
        return None
    return {
        'id': pc.punto_cuenta_id, 'numero': pc.numero, 'estado': pc.estado, 'puesto_id': pc.puesto_id,
        'referencia_constancia': pc.referencia_constancia, 'emitido_por': pc.emitido_por, 'emitido_el': pc.emitido_el,
        'decidido_por': pc.decidido_por, 'decidido_el': pc.decidido_el, 'tiene_documento': bool(pc.pdf_clave),
    }


def a_dict_fila_area(f: FilaEnriquecida, prioritarios: tuple) -> dict:
    exp, p = f.fila.expediente, f.fila.postulante
    return {
        'id': exp.id, 'numero': exp.numero, 'estado': exp.estado.value, 'ultimo_cambio': f.fila.ultimo_cambio,
        'es_reingreso': p.es_reingreso, 'pendiente': exp.estado in prioritarios,
        'postulante': {'cedula': p.cedula, 'nombres': p.nombres, 'apellidos': p.apellidos},
        'propuesta': {
            'cargo_id': exp.cargo_propuesto_id, 'cargo_texto': exp.cargo_propuesto_texto,
            'oficina_texto': exp.oficina_propuesta_texto, 'direccion_general_id': exp.direccion_general_id,
        },
        'diferido_vence_el': exp.diferido_vence_el,
        'reserva': {'puesto_id': f.reserva.puesto_id, 'vence_el': f.reserva.vence_el} if f.reserva else None,
        'tiene_constancia': f.constancia is not None,
        'punto_cuenta': {'numero': f.punto_cuenta.numero, 'estado': f.punto_cuenta.estado} if f.punto_cuenta else None,
    }


def a_dict_detalle_area(d: DetalleArea, area: str) -> dict:
    exp, p = d.base.expediente, d.base.postulante
    ruta = f'{RUTA_BASE}/{"solicitudes" if area == "presupuesto" else "ingresos"}/{exp.id}'
    return {
        'expediente': {
            **a_dict_expediente_resumen(exp), 'fecha_apertura': exp.fecha_apertura, 'fecha_cierre': exp.fecha_cierre,
            'observaciones': exp.observaciones, 'es_reingreso': p.es_reingreso,
            'reserva_vence_el': exp.reserva_vence_el, 'diferido_vence_el': exp.diferido_vence_el,
            'propuesta': {
                'cargo_id': exp.cargo_propuesto_id, 'cargo_especifico_id': exp.cargo_especifico_propuesto_id,
                'tipo_nomina_id': exp.tipo_nomina_propuesto_id, 'direccion_general_id': exp.direccion_general_id,
                'direccion_linea_id': exp.direccion_linea_id, 'coordinacion_id': exp.coordinacion_id,
                'dependencia_id': exp.dependencia_id, 'cargo_texto': exp.cargo_propuesto_texto,
                'oficina_texto': exp.oficina_propuesta_texto, 'nombres': d.propuesta_nombres,
            },
        },
        # Sin correo, teléfono ni Ventana 1: esas áreas no los necesitan.
        'postulante': {
            'id': p.id, 'cedula': p.cedula, 'nombres': p.nombres, 'apellidos': p.apellidos, 'es_reingreso': p.es_reingreso,
        },
        'reserva': a_dict_reserva(d.reserva, d.puesto),
        'puesto': a_dict_puesto(d.puesto),
        'constancia': a_dict_constancia(d.constancia),
        'punto_cuenta': a_dict_punto_cuenta(d.punto_cuenta),
        'documentos': {
            'punto_cuenta': f'{ruta}/punto-cuenta/' if d.punto_cuenta and d.punto_cuenta.pdf_clave else None,
            'constancia_adjunto': f'{ruta}/constancia/adjunto/' if d.constancia and d.constancia.tiene_adjunto else None,
        },
        'historial': [
            {'estado_origen': t.estado_origen, 'estado_destino': t.estado_destino, 'fecha': t.fecha,
             'actor_cedula': t.actor_cedula, 'actor_tipo': t.actor_tipo, 'motivo': t.motivo}
            for t in d.base.transiciones
        ],
        'acciones': [
            {'destino': a.destino, 'etiqueta': a.etiqueta, 'requiere_motivo': a.requiere_motivo,
             'bloqueada': a.bloqueada, 'motivo_bloqueo': a.motivo_bloqueo}
            for a in d.acciones
        ],
        'capacidades': {
            'puede_reservar': d.puede_reservar, 'puede_declarar_disponibilidad': d.puede_declarar,
        },
    }


# --- Promoción (G-4) ---
def a_dict_contratacion(r) -> dict:
    """Resultado de `promover_postulante`. NUNCA lleva contraseñas: la inicial es la cédula del trabajador (política vigente)."""
    p, c = r.promocion, r.promocion.cuenta
    return {
        'expediente': a_dict_expediente_resumen(r.expediente),
        'employee_id': p.employee_id, 'cedula': p.cedula, 'es_reingreso': p.es_reingreso,
        'puesto': {'id': r.reserva.puesto_id, 'codigo': p.puesto_codigo},
        'familiares_copiados': p.familiares_copiados,
        'reserva': {'id': r.reserva.id, 'estado': r.reserva.estado},
        'cuenta': {
            'creada': c.creada, 'reactivada': c.reactivada, 'motivo': c.motivo, 'correo': c.correo,
            'correo_alternativo': c.correo_alternativo,
            'dias_vigencia_clave_inicial': c.dias_vigencia_clave_inicial,
            'entrega': (
                'Cuenta creada: la contraseña inicial es la cédula del trabajador y vence en '
                f'{c.dias_vigencia_clave_inicial} días; debe cambiarla en su primer ingreso.'
                if c.creada and c.dias_vigencia_clave_inicial else None
            ),
        },
    }
