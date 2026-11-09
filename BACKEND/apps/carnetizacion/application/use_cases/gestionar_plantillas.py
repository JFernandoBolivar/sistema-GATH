"""
Casos de uso para consultar, crear, publicar y activar plantillas de carnet (O44 - E3).
Motor de plantillas por capas en mm, dos caras, tamaños libres, versiones e historial.
"""
from typing import Any

from apps.carnetizacion.application.dtos.carnetizacion_dtos import (
    PlantillaCarnetDTO,
    PlantillaDetalleDTO,
    TipoCredencialDTO,
)
from apps.carnetizacion.domain.entities.plantilla import PlantillaCarnet
from apps.carnetizacion.domain.entities.tipo_credencial import TipoCredencial
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion
from core.domain.exceptions import NotFoundError, ValidationError


def _plantilla_a_dto(p: PlantillaCarnet) -> PlantillaCarnetDTO:
    return PlantillaCarnetDTO(
        id=p.id,
        nombre=p.nombre,
        imagen_url=p.imagen_url,
        activo=p.activa,
        creado=p.creado,
    )


def _plantilla_a_detalle_dto(p: PlantillaCarnet) -> PlantillaDetalleDTO:
    return PlantillaDetalleDTO(
        id=p.id,
        nombre=p.nombre,
        codigo_tipo=p.codigo_tipo,
        ancho_mm=p.ancho_mm,
        alto_mm=p.alto_mm,
        orientacion=p.orientacion,
        regla_criterio=p.regla_criterio,
        regla_valor=p.regla_valor,
        estado=p.estado,
        activa=p.activa,
        version=p.version,
        definicion=p.definicion,
        creado=p.creado,
        actualizado=p.actualizado,
        plantilla_raiz_id=p.plantilla_raiz_id,
        creado_por=p.creado_por,
        descripcion=p.descripcion,
        imagen_url=p.imagen_url,
    )


def _tipo_a_dto(t: TipoCredencial) -> TipoCredencialDTO:
    return TipoCredencialDTO(
        codigo=t.codigo,
        nombre=t.nombre,
        descripcion=t.descripcion,
        ancho_mm=t.ancho_mm,
        alto_mm=t.alto_mm,
        orientacion=t.orientacion,
        grupo=t.grupo,
        activo=t.activo,
        orden=t.orden,
    )


def listar_tipos_credencial(
    repo: RepoCarnetizacion,
    solo_activos: bool = True,
    grupo: str | None = None,
) -> list[TipoCredencialDTO]:
    """Lista los tipos de credencial, opcionalmente filtrados por grupo."""
    opciones: dict[str, object] = {'solo_activos': solo_activos}
    if grupo is not None:
        opciones['grupo'] = grupo
    tipos = repo.listar_tipos_credencial(**opciones)
    return [_tipo_a_dto(t) for t in tipos]


def listar_plantillas(repo: RepoCarnetizacion) -> list[PlantillaCarnetDTO]:
    """Listado legacy retrocompatible."""
    entidades = repo.listar_plantillas()
    return [_plantilla_a_dto(e) for e in entidades]


def listar_plantillas_motor(
    repo: RepoCarnetizacion,
    codigo_tipo: str | None = None,
    estado: str | None = None,
    solo_activas: bool = False,
) -> list[PlantillaDetalleDTO]:
    """Listado completo del motor de plantillas por capas con filtros."""
    plantillas = repo.listar_plantillas(
        codigo_tipo=codigo_tipo,
        estado=estado,
        solo_activas=solo_activas,
    )
    return [_plantilla_a_detalle_dto(p) for p in plantillas]


def obtener_plantilla_detalle(repo: RepoCarnetizacion, plantilla_id: str | int) -> PlantillaDetalleDTO:
    """Obtiene la definición completa de una plantilla."""
    p = repo.obtener_plantilla(plantilla_id)
    if not p:
        raise NotFoundError(f"Plantilla con id {plantilla_id} no encontrada")
    return _plantilla_a_detalle_dto(p)


def obtener_plantilla_activa(
    repo: RepoCarnetizacion,
    codigo_tipo: str = "trabajador",
    regla_criterio: str = "todos",
    regla_valor: str = "*",
) -> PlantillaDetalleDTO:
    """Obtiene la plantilla actualmente activa por tipo y regla."""
    p = repo.obtener_plantilla_activa(
        codigo_tipo=codigo_tipo,
        regla_criterio=regla_criterio,
        regla_valor=regla_valor,
    )
    if not p:
        raise NotFoundError(f"No existe plantilla activa para tipo '{codigo_tipo}' con regla '{regla_criterio}={regla_valor}'")
    return _plantilla_a_detalle_dto(p)


def crear_plantilla_borrador(
    repo: RepoCarnetizacion,
    nombre: str,
    codigo_tipo: str,
    definicion: dict[str, Any],
    ancho_mm: float = 54.0,
    alto_mm: float = 85.6,
    orientacion: str = "vertical",
    regla_criterio: str = "todos",
    regla_valor: str = "*",
    descripcion: str = "",
    creado_por: str | None = None,
) -> PlantillaDetalleDTO:
    """Crea una nueva plantilla en estado borrador para edición en el diseñador."""
    if not nombre or not nombre.strip():
        raise ValidationError("El nombre de la plantilla es obligatorio")
    if ancho_mm <= 0 or alto_mm <= 0:
        raise ValidationError("Las dimensiones en mm deben ser positivas")
    if not isinstance(definicion, dict):
        raise ValidationError("La definición de capas debe ser un diccionario válido")

    # Asegurar claves mínimas de definición
    definicion.setdefault('anverso', [])
    definicion.setdefault('reverso', [])
    definicion.setdefault('bg', {'anverso': '#ffffff', 'reverso': '#ffffff'})

    p = repo.crear_plantilla_borrador(
        nombre=nombre.strip(),
        codigo_tipo=codigo_tipo,
        definicion=definicion,
        ancho_mm=ancho_mm,
        alto_mm=alto_mm,
        orientacion=orientacion,
        regla_criterio=regla_criterio,
        regla_valor=regla_valor,
        descripcion=descripcion,
        creado_por=creado_por,
    )
    return _plantilla_a_detalle_dto(p)


def actualizar_borrador_plantilla(
    repo: RepoCarnetizacion,
    plantilla_id: str | int,
    nombre: str | None = None,
    definicion: dict[str, Any] | None = None,
    ancho_mm: float | None = None,
    alto_mm: float | None = None,
    orientacion: str | None = None,
    regla_criterio: str | None = None,
    regla_valor: str | None = None,
    descripcion: str | None = None,
) -> PlantillaDetalleDTO:
    """Actualiza los datos y definición de un borrador."""
    p = repo.actualizar_borrador(
        plantilla_id=plantilla_id,
        nombre=nombre.strip() if nombre else None,
        definicion=definicion,
        ancho_mm=ancho_mm,
        alto_mm=alto_mm,
        orientacion=orientacion,
        regla_criterio=regla_criterio,
        regla_valor=regla_valor,
        descripcion=descripcion,
    )
    return _plantilla_a_detalle_dto(p)


def publicar_plantilla(
    repo: RepoCarnetizacion,
    plantilla_id: str | int,
    activar: bool = True,
    publicado_por: str | None = None,
) -> PlantillaDetalleDTO:
    """
    Publica una plantilla. Genera una versión inmutable e incrementa versionado.
    Si activar=True, desactiva la versión activa previa del mismo tipo y regla.
    """
    p = repo.publicar_plantilla(
        plantilla_id=plantilla_id,
        activar=activar,
        publicado_por=publicado_por,
    )
    return _plantilla_a_detalle_dto(p)


def activar_plantilla(repo: RepoCarnetizacion, plantilla_id: str | int) -> PlantillaCarnetDTO:
    """Activa o reactiva una plantilla publicada, asegurando solo una activa por tipo y regla."""
    entidad = repo.activar_plantilla(plantilla_id)
    return _plantilla_a_dto(entidad)


def activar_plantilla_motor(repo: RepoCarnetizacion, plantilla_id: str | int) -> PlantillaDetalleDTO:
    """Activa o reactiva una versión publicada (motor), devolviendo detalle completo."""
    entidad = repo.activar_plantilla(plantilla_id)
    return _plantilla_a_detalle_dto(entidad)


def listar_versiones_plantilla(
    repo: RepoCarnetizacion,
    plantilla_raiz_id: str | int,
) -> list[PlantillaDetalleDTO]:
    """Historial completo de versiones de una plantilla."""
    versiones = repo.listar_versiones_plantilla(plantilla_raiz_id)
    return [_plantilla_a_detalle_dto(v) for v in versiones]
