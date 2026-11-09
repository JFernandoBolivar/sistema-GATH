"""
Implementación ORM del repositorio de guías interactivas vistas (O35).
"""
from apps.autogestion.domain.entities.guia_vista import GuiaVista
from apps.autogestion.domain.ports.repo_guia_vista import RepoGuiaVista
from apps.autogestion.infrastructure.models.guia_vista_models import GuiaVistaModel


class RepoGuiaVistaORM(RepoGuiaVista):
    """Repositorio Django ORM para `GuiaVistaModel`."""

    def listar_vistas_por_cedula(self, cedula: str) -> list[GuiaVista]:
        registros = GuiaVistaModel.objects.filter(cedula=cedula).order_by("-created_at")
        return [
            GuiaVista(
                id=str(r.id),
                cedula=r.cedula,
                guia_id=r.guia_id,
                version=r.version,
                fecha_vista=r.created_at,
            )
            for r in registros
        ]

    def ha_visto_guia(self, cedula: str, guia_id: str, version: int) -> bool:
        return GuiaVistaModel.objects.filter(
            cedula=cedula,
            guia_id=guia_id,
            version__gte=version,
        ).exists()

    def registrar_vista(self, cedula: str, guia_id: str, version: int) -> GuiaVista:
        obj, _ = GuiaVistaModel.objects.get_or_create(
            cedula=cedula,
            guia_id=guia_id,
            version=version,
        )
        return GuiaVista(
            id=str(obj.id),
            cedula=obj.cedula,
            guia_id=obj.guia_id,
            version=obj.version,
            fecha_vista=obj.created_at,
        )
