"""Repositorio ORM de la marca de desactivación por egreso (implementa `RepoDesactivacionEgreso`)."""
from apps.identidad.infrastructure.models.desactivacion_egreso_model import DesactivacionEgresoModel


class RepoDesactivacionEgresoORM:
    def marcar(self, cuenta_id: int, motivo: str) -> None:
        DesactivacionEgresoModel.objects.update_or_create(cuenta_id=cuenta_id, defaults={'motivo': motivo[:100]})

    def existe(self, cuenta_id: int) -> bool:
        return DesactivacionEgresoModel.objects.filter(cuenta_id=cuenta_id).exists()

    def limpiar(self, cuenta_id: int) -> None:
        DesactivacionEgresoModel.objects.filter(cuenta_id=cuenta_id).delete()
