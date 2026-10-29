"""
Mappers de Carnetización.
"""
from apps.carnetizacion.domain.entities.carnet import Carnet
from apps.carnetizacion.domain.entities.plantilla import PlantillaCarnet
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    CarnetTemplateModel,
)


def carnet_a_entidad(modelo: CarnetEmitidoModel) -> Carnet:
    emp = modelo.employee
    nombres = emp.nombres if emp else ""
    apellidos = emp.apellidos if emp else ""
    return Carnet(
        id=modelo.pk,
        empleado_cedula=str(modelo.employee_id),
        empleado_nombres=nombres,
        empleado_apellidos=apellidos,
        security_hash=modelo.security_hash,
        fecha_emision=str(modelo.fecha_emision),
        motivo_id=modelo.motivo_id,
        motivo_nombre=modelo.motivo.nombre if modelo.motivo else "",
        activo=modelo.activo,
        observaciones=modelo.observaciones,
    )


def plantilla_a_entidad(modelo: CarnetTemplateModel) -> PlantillaCarnet:
    return PlantillaCarnet(
        id=modelo.pk,
        nombre=modelo.nombre,
        imagen_url=(
            f"/api/v1/carnetizacion/plantillas/{modelo.pk}/imagen/" if modelo.imagen else ""
        ),
        activo=modelo.activo,
        creado=str(modelo.creado),
    )
