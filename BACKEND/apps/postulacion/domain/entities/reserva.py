"""Reserva de un puesto (AsigTrabajo) para un expediente en Presupuesto (E-2, C-4). Sin Django."""
from dataclasses import dataclass
from datetime import datetime

ACTIVA = 'ACTIVA'
LIBERADA = 'LIBERADA'
CONSUMIDA = 'CONSUMIDA'
VENCIDA = 'VENCIDA'
ESTADOS_RESERVA = (ACTIVA, LIBERADA, CONSUMIDA, VENCIDA)

# Motivos con que el sistema libera una reserva (texto libre en la columna; estos son los que genera el código).
MOTIVO_CAMBIO_PUESTO = 'cambio de puesto'
MOTIVO_DEVOLUCION = 'devolución'
MOTIVO_DIFERIDO = 'diferido'
MOTIVO_RECHAZO_DIRECCION = 'rechazo de Dirección General'
MOTIVO_VENCIMIENTO = 'vencimiento de la reserva'
MOTIVO_LIBERADA_POR_USUARIO = 'liberada por Presupuesto'
MOTIVO_CONTRATACION = 'contratación'   # la reserva pasa a CONSUMIDA al asignar el cargo (G-4)


@dataclass(frozen=True)
class ReservaPuesto:
    """El puesto va por id (tabla heredada, sin FK dura). Una ACTIVA por puesto y una por expediente."""

    id: str
    expediente_id: str
    puesto_id: int
    reservado_por: str          # cédula de quien reservó
    reservado_el: datetime
    vence_el: datetime
    estado: str = ACTIVA
    motivo_liberacion: str = ''
    cerrada_el: datetime | None = None

    @property
    def activa(self) -> bool:
        return self.estado == ACTIVA

    def vigente(self, ahora: datetime) -> bool:
        return self.activa and ahora <= self.vence_el
