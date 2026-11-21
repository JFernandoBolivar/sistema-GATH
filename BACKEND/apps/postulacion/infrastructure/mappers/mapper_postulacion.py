"""Mappers ORM <-> entidades de postulación."""
from apps.postulacion.domain.entities.credencial import CredencialPostulante
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import Postulante, TransicionRegistrada
from apps.postulacion.domain.entities.psicofisico import ResultadoPsicofisico
from apps.postulacion.domain.value_objects.estados import EstadoExpediente

CAMPOS_EXPEDIENTE = (
    'cargo_propuesto_id', 'cargo_especifico_propuesto_id', 'tipo_nomina_propuesto_id', 'direccion_general_id',
    'direccion_linea_id', 'coordinacion_id', 'dependencia_id', 'cargo_propuesto_texto', 'oficina_propuesta_texto',
    'ventana', 'ventana_vence_el', 'reserva_vence_el', 'diferido_vence_el', 'observaciones', 'datos_ventana1', 'fecha_cierre',
    'creado_por',
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


CAMPOS_PSICOFISICO = (
    'resultado', 'fecha_aplicacion', 'observaciones', 'informe_clave', 'informe_sha256', 'informe_tamano',
    'registrado_por', 'registrado_el',
)


def psicofisico_a_entidad(m) -> ResultadoPsicofisico:
    return ResultadoPsicofisico(
        expediente_id=str(m.expediente_id), **{c: getattr(m, c) for c in CAMPOS_PSICOFISICO},
    )
