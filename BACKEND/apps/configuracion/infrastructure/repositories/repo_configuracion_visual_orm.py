"""Implementación ORM del puerto `RepoConfiguracionVisual` (Regla D-09)."""
from django.db import transaction

from apps.configuracion.infrastructure.mappers.mapper_configuracion_visual import a_entidad
from apps.configuracion.infrastructure.models.configuracion_visual_model import ConfiguracionVisualModel

_CAMPOS_EDITABLES = ('tipo_cintillo', 'nombre_empresa', 'color_fondo')


class RepoConfiguracionVisualORM:
    def _obtener_o_crear_fila(self):
        fila = ConfiguracionVisualModel.objects.select_for_update().first()
        if fila is None:
            fila = ConfiguracionVisualModel.objects.create()
        return fila

    def obtener(self):
        fila = ConfiguracionVisualModel.objects.first()
        if fila is None:
            fila = ConfiguracionVisualModel.objects.create()
        return a_entidad(fila)

    @transaction.atomic
    def actualizar(self, datos: dict, usuario_id: int | None = None):
        fila = self._obtener_o_crear_fila()
        for campo in _CAMPOS_EDITABLES:
            if campo in datos and datos[campo] is not None:
                setattr(fila, campo, datos[campo])
        fila.actualizado_por_id = usuario_id
        fila.save()
        return a_entidad(fila)

    @transaction.atomic
    def guardar_logo(self, campo: str, clave: str, usuario_id: int | None = None):
        fila = self._obtener_o_crear_fila()
        setattr(fila, campo, clave)
        fila.actualizado_por_id = usuario_id
        fila.save()
        return a_entidad(fila)
