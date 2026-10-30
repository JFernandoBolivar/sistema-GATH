"""
Traduce un movimiento registrado a las notificaciones del sistema (G8). Puro:
sin Django ni ORM, recibe la entidad `MovimientoCargo` y el tipo de evento ya
resuelto por el receptor.

Destinatarios:
- RRHH y Bienestar Social: todas las cuentas activas con el permiso
  `personal.recibir_avisos_movimientos` (bandeja `personal`).
- El trabajador afectado (bandeja `autogestion`), salvo en un egreso: su cuenta
  queda desactivada.

La `clave` es el id del movimiento, de modo que reprocesar el mismo hecho no
duplica avisos. El correo queda detrás del ajuste
`NOTIFICAR_MOVIMIENTOS_POR_CORREO` (por defecto apagado).
"""
from datetime import datetime
from typing import Protocol
from zoneinfo import ZoneInfo

from apps.movimientos.domain.value_objects.permisos_movimientos import (
    PERMISO_AVISOS_MOVIMIENTOS,
)
from core.domain.notificaciones import CorreoSolicitado, SolicitudNotificacion

ZONA = ZoneInfo('America/Caracas')
REF_TIPO = 'movimiento'
MODULO_RRHH = 'personal'
MODULO_TRABAJADOR = 'autogestion'
ENLACE_RRHH = '/movimientos'
ENLACE_TRABAJADOR = '/autogestion'

TIPO_INGRESO = 'INGRESO'
TIPO_TRASLADO = 'TRASLADO'
TIPO_CAMBIO_ESTATUS = 'CAMBIO DE ESTATUS'
TIPO_EGRESO = 'EGRESO'
TIPO_SOBREVIVIENTE = 'SOBREVIVIENTE'

# Tipos de notificación (deben existir en `tipos-notificacion.ts`).
TIPOS_NOTIFICACION = {
    TIPO_INGRESO: 'movimiento.ingreso',
    TIPO_TRASLADO: 'movimiento.traslado',
    TIPO_CAMBIO_ESTATUS: 'movimiento.cambio_estatus',
    TIPO_EGRESO: 'movimiento.egreso',
    TIPO_SOBREVIVIENTE: 'movimiento.sobreviviente',
}

_TITULOS_RRHH = {
    TIPO_INGRESO: 'Ingreso de personal registrado',
    TIPO_TRASLADO: 'Traslado de personal registrado',
    TIPO_CAMBIO_ESTATUS: 'Cambio de estatus registrado',
    TIPO_EGRESO: 'Egreso de personal registrado',
    TIPO_SOBREVIVIENTE: 'Alta de pensionado por sobrevivencia registrada',
}

_TITULOS_TRABAJADOR = {
    TIPO_INGRESO: 'Se registró su ingreso',
    TIPO_TRASLADO: 'Se registró un traslado en su expediente',
    TIPO_CAMBIO_ESTATUS: 'Se registró un cambio de estatus en su expediente',
}

# Un egreso (o el alta de un sobreviviente) no genera aviso al trabajador: su
# cuenta queda desactivada o todavía no existe.
TIPOS_QUE_NOTIFICAN_AL_TRABAJADOR = (
    TIPO_INGRESO, TIPO_TRASLADO, TIPO_CAMBIO_ESTATUS,
)


class DatosMovimiento(Protocol):
    """Datos del movimiento que necesita el aviso (los cumple la entidad y el DTO)."""

    id: int
    empleado_cedula: str
    codigo_puesto: str
    denominacion_nombre: str
    dependencia_nombre: str | None
    direccion_general_nombre: str | None
    motivo_nombre: str | None
    fecha_movimiento: str


def solicitudes_de_movimiento(
    movimiento: DatosMovimiento, tipo_evento: str, *, correo_activo: bool = False,
) -> list[SolicitudNotificacion]:
    """Notificaciones que corresponden al movimiento ('' si el tipo no aplica)."""
    tipo_notificacion = TIPOS_NOTIFICACION.get(tipo_evento)
    if not tipo_notificacion:
        return []

    comunes = {
        'tipo': tipo_notificacion,
        'ref_tipo': REF_TIPO,
        'ref_id': str(movimiento.id),
        'clave': str(movimiento.id),
    }
    detalle = _detalle(movimiento)
    correo_rrhh = (
        CorreoSolicitado(f'{_TITULOS_RRHH[tipo_evento]} - GATH CONATEL')
        if correo_activo else None
    )

    solicitudes = [
        SolicitudNotificacion(
            **comunes,
            permiso_destino=PERMISO_AVISOS_MOVIMIENTOS,
            modulo=MODULO_RRHH,
            enlace=ENLACE_RRHH,
            titulo=_TITULOS_RRHH[tipo_evento],
            mensaje=(
                f'Se registró {_descripcion(tipo_evento)} del trabajador '
                f'C.I. {movimiento.empleado_cedula}: {detalle}. '
                'Ingrese al módulo de movimientos para consultar el detalle.'
            ),
            correo=correo_rrhh,
        )
    ]

    if tipo_evento in TIPOS_QUE_NOTIFICAN_AL_TRABAJADOR:
        solicitudes.append(SolicitudNotificacion(
            **comunes,
            cedula_destino=movimiento.empleado_cedula,
            modulo=MODULO_TRABAJADOR,
            enlace=ENLACE_TRABAJADOR,
            titulo=_TITULOS_TRABAJADOR[tipo_evento],
            mensaje=(
                f'Recursos Humanos registró {_descripcion(tipo_evento)} en su '
                f'expediente: {detalle}. Si no reconoce este movimiento, comuníquese '
                'con la Oficina de Gestión Humana.'
            ),
            correo=(
                CorreoSolicitado(f'{_TITULOS_TRABAJADOR[tipo_evento]} - GATH CONATEL')
                if correo_activo else None
            ),
        ))

    return solicitudes


def _descripcion(tipo_evento: str) -> str:
    return {
        TIPO_INGRESO: 'un ingreso',
        TIPO_TRASLADO: 'un traslado',
        TIPO_CAMBIO_ESTATUS: 'un cambio de estatus',
        TIPO_EGRESO: 'un egreso',
        TIPO_SOBREVIVIENTE: 'un alta como pensionado por sobrevivencia',
    }.get(tipo_evento, 'un movimiento')


def _detalle(movimiento: DatosMovimiento) -> str:
    partes = [
        f'cargo {movimiento.denominacion_nombre or "N/A"}',
        f'código {movimiento.codigo_puesto or "N/A"}',
    ]
    if movimiento.dependencia_nombre:
        partes.append(f'dependencia {movimiento.dependencia_nombre}')
    if movimiento.direccion_general_nombre:
        partes.append(f'gerencia {movimiento.direccion_general_nombre}')
    if movimiento.motivo_nombre:
        partes.append(f'motivo {movimiento.motivo_nombre}')
    partes.append(f'fecha {_fecha(movimiento.fecha_movimiento)}')
    return ', '.join(partes)


def _fecha(valor: str) -> str:
    try:
        return datetime.fromisoformat(str(valor)).astimezone(ZONA).strftime('%d/%m/%Y %I:%M %p')
    except (TypeError, ValueError):
        return str(valor or '')
