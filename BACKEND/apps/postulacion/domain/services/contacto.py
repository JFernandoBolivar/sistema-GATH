"""Tarea «contactar al postulante» (G-1): antigüedad y escalamiento. Puro: sin Django."""
from datetime import datetime, timedelta

from apps.postulacion.domain.entities.expediente import ExpedientePostulacion


def contacto_pendiente(exp: ExpedientePostulacion) -> bool:
    return exp.contacto_pendiente_desde is not None


def limite_de_atraso(ahora: datetime, horas: int) -> datetime:
    """Un contacto pendiente desde ANTES de este instante está atrasado."""
    return ahora - timedelta(hours=horas)


def contacto_atrasado(exp: ExpedientePostulacion, ahora: datetime, horas: int) -> bool:
    desde = exp.contacto_pendiente_desde
    return desde is not None and desde <= limite_de_atraso(ahora, horas)
