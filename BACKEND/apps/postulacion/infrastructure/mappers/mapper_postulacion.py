"""Mappers ORM <-> entidades de postulación."""
from apps.postulacion.domain.entities.constancia import ConstanciaPresupuestaria
from apps.postulacion.domain.entities.credencial import CredencialPostulante
from apps.postulacion.domain.entities.enlace_activacion import EnlaceActivacion
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import Postulante, TransicionRegistrada
from apps.postulacion.domain.entities.psicofisico import ResultadoPsicofisico
from apps.postulacion.domain.entities.punto_cuenta_ingreso import PuntoCuentaIngreso
from apps.postulacion.domain.entities.reserva import ReservaPuesto
from apps.postulacion.domain.value_objects.estados import EstadoExpediente

CAMPOS_EXPEDIENTE = (
    'cargo_propuesto_id', 'cargo_especifico_propuesto_id', 'tipo_nomina_propuesto_id', 'direccion_general_id',
    'direccion_linea_id', 'coordinacion_id', 'dependencia_id', 'cargo_propuesto_texto', 'oficina_propuesta_texto',
    'ventana', 'ventana_vence_el', 'reserva_vence_el', 'diferido_vence_el', 'observaciones', 'datos_ventana1', 'fecha_cierre',
    'creado_por', 'datos_ventana2', 'foto_clave', 'foto_sha256', 'foto_tamano', 'foto_subida_el',
    'contacto_pendiente_desde', 'requiere_presupuesto', 'requiere_direccion_general',
)


def postulante_a_entidad(m) -> Postulante:
    return Postulante(
        id=str(m.pk), cedula=m.cedula, nombres=m.nombres, apellidos=m.apellidos, correo=m.correo,
        telefono_movil=m.telefono_movil, employee_cedula=m.employee_cedula, creado_por=m.creado_por,
        fecha_creacion=m.created_at,
    )


def expediente_a_entidad(m) -> ExpedientePostulacion:
    return ExpedientePostulacion(
        id=str(m.pk), numero=m.numero, postulante_id=str(m.postulante_id), estado=EstadoExpediente(m.estado),
        fecha_apertura=m.fecha_apertura, **{c: getattr(m, c) for c in CAMPOS_EXPEDIENTE},
    )


def campos_de_expediente(e: ExpedientePostulacion) -> dict:
    return {'estado': e.estado.value, **{c: getattr(e, c) for c in CAMPOS_EXPEDIENTE}}


def transicion_a_entidad(m) -> TransicionRegistrada:
    return TransicionRegistrada(
        id=str(m.pk), expediente_id=str(m.expediente_id), estado_origen=m.estado_origen,
        estado_destino=m.estado_destino, actor_cedula=m.actor_cedula, actor_tipo=m.actor_tipo, fecha=m.fecha,
        motivo=m.motivo, datos_extra=dict(m.datos_extra or {}),
    )


CAMPOS_CREDENCIAL = (
    'usuario', 'clave_hash', 'ventana', 'vence_el', 'debe_cambiar_clave', 'intentos_fallidos', 'bloqueada_hasta',
    'ultimo_acceso', 'emitida_por', 'emitida_el', 'version_sesion', 'revocada',
)


def credencial_a_entidad(m) -> CredencialPostulante:
    return CredencialPostulante(
        id=str(m.pk), expediente_id=str(m.expediente_id), **{c: getattr(m, c) for c in CAMPOS_CREDENCIAL},
    )


CAMPOS_ENLACE_ACTIVACION = (
    'token_hash', 'correo_destino', 'creado_por', 'creado_el', 'vence_el', 'usado_el', 'ip_uso', 'intentos', 'revocado',
)


def enlace_activacion_a_entidad(m) -> EnlaceActivacion:
    return EnlaceActivacion(
        id=str(m.pk), expediente_id=str(m.expediente_id), **{c: getattr(m, c) for c in CAMPOS_ENLACE_ACTIVACION},
    )


CAMPOS_PSICOFISICO = (
    'resultado', 'fecha_aplicacion', 'observaciones', 'informe_clave', 'informe_sha256', 'informe_tamano',
    'registrado_por', 'registrado_el',
)


def psicofisico_a_entidad(m) -> ResultadoPsicofisico:
    return ResultadoPsicofisico(
        expediente_id=str(m.expediente_id), **{c: getattr(m, c) for c in CAMPOS_PSICOFISICO},
    )


CAMPOS_RESERVA = ('puesto_id', 'reservado_por', 'reservado_el', 'vence_el', 'estado', 'motivo_liberacion', 'cerrada_el')


def reserva_a_entidad(m) -> ReservaPuesto:
    return ReservaPuesto(id=str(m.pk), expediente_id=str(m.expediente_id), **{c: getattr(m, c) for c in CAMPOS_RESERVA})


CAMPOS_CONSTANCIA = (
    'declarado_por_cedula', 'declarado_por_nombre', 'referencia', 'fecha', 'observaciones', 'adjunto_clave',
    'adjunto_sha256', 'adjunto_tamano',
)


def constancia_a_entidad(m) -> ConstanciaPresupuestaria:
    return ConstanciaPresupuestaria(expediente_id=str(m.expediente_id), **{c: getattr(m, c) for c in CAMPOS_CONSTANCIA})


CAMPOS_PUNTO_CUENTA_INGRESO = (
    'numero', 'pdf_clave', 'estado', 'puesto_id', 'referencia_constancia', 'emitido_por', 'emitido_el', 'decidido_por',
    'decidido_el', 'aprobado_fuera_sistema', 'fecha_firma', 'registrado_por_nombre', 'pdf_firmado_clave',
    'pdf_firmado_sha256', 'pdf_firmado_tamano',
)


def punto_cuenta_ingreso_a_entidad(m) -> PuntoCuentaIngreso:
    return PuntoCuentaIngreso(
        expediente_id=str(m.expediente_id), punto_cuenta_id=str(m.punto_cuenta_id),
        **{c: getattr(m, c) for c in CAMPOS_PUNTO_CUENTA_INGRESO},
    )
