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




# Catálogo base. Contratado, pasante y autoridad son credenciales internas (grupo
# trabajador): comparten la plantilla institucional y no son credenciales externas.
TIPOS_CREDENCIAL_BASE = (
    {
        'codigo': 'trabajador',
        'nombre': 'Trabajador Activo',
        'descripcion': 'Credencial oficial para personal activo institucional',
        'grupo': 'trabajador',
        'orden': 1,
    },
    {
        'codigo': 'pasivo',
        'nombre': 'Pasivo / Jubilado / Pensionado',
        'descripcion': 'Credencial oficial para personal jubilado, pensionado o sobreviviente',
        'grupo': 'pasivo',
        'orden': 2,
    },
    {
        'codigo': 'contratado',
        'nombre': 'Contratado',
        'descripcion': 'Credencial oficial para personal contratado por la institución',
        'grupo': 'trabajador',
        'orden': 3,
    },
    {
        'codigo': 'pasante',
        'nombre': 'Pasante',
        'descripcion': 'Credencial oficial para pasantes y personal en formación',
        'grupo': 'trabajador',
        'orden': 4,
    },
    {
        'codigo': 'autoridad',
        'nombre': 'Autoridad',
        'descripcion': 'Credencial oficial para autoridades y directivos de la institución',
        'grupo': 'trabajador',
        'orden': 5,
    },
)


class RepoTiposCredencialMixin:
    def _asegurar_catalogos_semilla(self) -> None:
        """Siembra de forma idempotente los tipos de credencial base.

        No actualiza los que ya existen (el área usuaria puede haber ajustado nombre,
        orden o grupo); solo agrega los que falten en instalaciones anteriores.
        """
        for datos in TIPOS_CREDENCIAL_BASE:
            TipoCredencialModel.objects.get_or_create(
                codigo=datos['codigo'],
                defaults={
                    'nombre': datos['nombre'],
                    'descripcion': datos['descripcion'],
                    'ancho_mm': 54.00,
                    'alto_mm': 85.60,
                    'orientacion': 'vertical',
                    'grupo': datos['grupo'],
                    'activo': True,
                    'orden': datos['orden'],
                },
            )

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
