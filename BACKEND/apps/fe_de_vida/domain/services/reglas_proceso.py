"""Regla de envío dentro de un proceso y su prórroga (PLAN_PRIORIDAD §2.2). Sin Django."""
from datetime import datetime

from apps.fe_de_vida.domain.entities.proceso import ProcesoFeDeVida, ProrrogaProceso
from apps.fe_de_vida.domain.value_objects.estados import EstadoProceso
from core.domain.exceptions import ConflictError


def prorroga_vigente(prorrogas: list[ProrrogaProceso], cedula: str, ahora: datetime) -> ProrrogaProceso | None:
    """La prórroga (individual o general) vigente que más tarde vence, o None."""
    aplicables = [p for p in prorrogas if p.alcanza(cedula) and p.vigente(ahora)]
    return max(aplicables, key=lambda p: p.nueva_fecha_limite, default=None)


def puede_enviar(proceso: ProcesoFeDeVida, prorrogas: list[ProrrogaProceso], cedula: str, ahora: datetime) -> bool:
    """
    Proceso ABIERTO y en plazo: sí. Cerrado (o abierto pero vencido): solo con prórroga vigente que
    alcance a la cédula. Un proceso en BORRADOR no admite envíos ni con prórroga.
    """
    if proceso.estado is EstadoProceso.BORRADOR:
        return False
    if proceso.en_plazo(ahora):
        return True
    return prorroga_vigente(prorrogas, cedula, ahora) is not None


def revision_cerrada(
    proceso: ProcesoFeDeVida, prorrogas: list[ProrrogaProceso], cedula: str, ahora: datetime,
) -> bool:
    """
    Un proceso cerrado deja de admitir decisiones de revisión solo cuando ninguna prórroga vigente alcanza a
    la cédula. La prórroga extiende la ventana completa: el pasivo sigue enviando y Bienestar sigue revisando
    lo que se envía durante la prórroga.
    """
    return proceso.estado is EstadoProceso.CERRADO and prorroga_vigente(prorrogas, cedula, ahora) is None


def exigir_puede_enviar(proceso: ProcesoFeDeVida, prorrogas: list[ProrrogaProceso], cedula: str, ahora: datetime) -> None:
    if proceso.estado is EstadoProceso.BORRADOR:
        raise ConflictError("El proceso de fe de vida aún no está abierto.")
    if not puede_enviar(proceso, prorrogas, cedula, ahora):
        raise ConflictError(
            "El proceso de fe de vida está cerrado y no tiene una prórroga vigente para usted. "
            "Comuníquese con Bienestar Social."
        )
