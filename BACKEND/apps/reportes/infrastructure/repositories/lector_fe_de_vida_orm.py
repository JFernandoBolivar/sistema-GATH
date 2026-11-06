"""Adaptador ORM del puerto `LectorFeDeVida` (solo infraestructura de reportes)."""
from apps.fe_de_vida.domain.value_objects.estados import EstadoProceso
from apps.fe_de_vida.infrastructure.models.solicitud_models import SolicitudFeDeVidaModel


class LectorFeDeVidaORM:
    def estado_por_cedula(self, cedulas: list[str]) -> dict[str, str]:
        salida: dict[str, str] = {}
        if not cedulas:
            return salida
        solicitudes = (
            SolicitudFeDeVidaModel.objects
            .filter(cedula__in=cedulas, proceso__estado=EstadoProceso.ABIERTO.value)
            .order_by('cedula', '-created_at')
        )
        for solicitud in solicitudes:
            salida.setdefault(solicitud.cedula, solicitud.estado)
        return salida
