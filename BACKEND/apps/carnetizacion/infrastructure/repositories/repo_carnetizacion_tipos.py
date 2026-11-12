"""Repositorio de carnetizaciÃ³n: tipos plantillas."""

from apps.carnetizacion.domain.entities.tipo_credencial import TipoCredencial
from apps.carnetizacion.infrastructure.mappers.mapper_carnetizacion import (
    tipo_credencial_a_entidad,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    TipoCredencialModel,
)

# Import entre módulos en infrastructure (apps.cargos y apps.personal): mismo patrón ya
# establecido en `apps.reportes`/`apps.autogestion`/`apps.pasivos`.




class RepoTiposCredencialMixin:
    def _asegurar_catalogos_semilla(self) -> None:
        """Siembra los tipos de credencial base (trabajadores y pasivos) si la tabla está vacía."""
        if not TipoCredencialModel.objects.exists():
            TipoCredencialModel.objects.bulk_create([
                TipoCredencialModel(
                    codigo='trabajador',
                    nombre='Trabajador Activo',
                    descripcion='Credencial oficial para personal activo institucional',
                    ancho_mm=54.00,
                    alto_mm=85.60,
                    orientacion='vertical',
                    activo=True,
                    orden=1,
                ),
                TipoCredencialModel(
                    codigo='pasivo',
                    nombre='Pasivo / Jubilado / Pensionado',
                    descripcion='Credencial oficial para personal jubilado, pensionado o sobreviviente',
                    ancho_mm=54.00,
                    alto_mm=85.60,
                    orientacion='vertical',
                    activo=True,
                    orden=2,
                ),
            ])

    def listar_tipos_credencial(
        self, solo_activos: bool = True, grupo: str | None = None
    ) -> list[TipoCredencial]:
        self._asegurar_catalogos_semilla()
        qs = TipoCredencialModel.objects.all().order_by('orden', 'nombre')
        if solo_activos:
            qs = qs.filter(activo=True)
        if grupo:
            qs = qs.filter(grupo=grupo)
        return [tipo_credencial_a_entidad(t) for t in qs]

    def obtener_tipo_credencial(self, codigo: str) -> TipoCredencial | None:
        self._asegurar_catalogos_semilla()
        obj = TipoCredencialModel.objects.filter(codigo=codigo).first()
        return tipo_credencial_a_entidad(obj) if obj else None
