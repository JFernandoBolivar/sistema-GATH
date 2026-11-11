"""Marca persistente de ejecuciones únicas de despliegue (S2-02)."""
from django.utils import timezone

from apps.identidad.infrastructure.models.ejecucion_unica_model import EjecucionUnicaModel


def ya_ejecutada(clave: str) -> bool:
    return EjecucionUnicaModel.objects.filter(clave=clave).exists()


def marcar_ejecutada(clave: str) -> None:
    EjecucionUnicaModel.objects.update_or_create(
        clave=clave, defaults={'ejecutada_en': timezone.now()},
    )
