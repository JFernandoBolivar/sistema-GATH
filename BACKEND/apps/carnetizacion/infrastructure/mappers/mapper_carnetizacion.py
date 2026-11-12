"""
Mappers de Carnetización (Regla B26, O44 - E3).
"""
from apps.carnetizacion.domain.entities.campo_credencial import CampoCredencial
from apps.carnetizacion.domain.entities.carnet import Carnet
from apps.carnetizacion.domain.entities.credencial_externa import CredencialExterna
from apps.carnetizacion.domain.entities.elemento_biblioteca import ElementoBiblioteca
from apps.carnetizacion.domain.entities.plantilla import PlantillaCarnet
from apps.carnetizacion.domain.entities.tipo_credencial import TipoCredencial
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    CarnetTemplateModel,
    ElementoBibliotecaModel,
    PlantillaCarnetModel,
    TipoCredencialModel,
    CampoPersonalizadoModel,
)
from apps.carnetizacion.infrastructure.models.credencial_externa_model import (
    CredencialExternaModel,
)


def tipo_credencial_a_entidad(modelo: TipoCredencialModel) -> TipoCredencial:
    return TipoCredencial(
        codigo=modelo.codigo,
        nombre=modelo.nombre,
        descripcion=modelo.descripcion,
        ancho_mm=float(modelo.ancho_mm),
        alto_mm=float(modelo.alto_mm),
        orientacion=modelo.orientacion,
        grupo=modelo.grupo,
        activo=modelo.activo,
        orden=modelo.orden,
    )


def plantilla_motor_a_entidad(modelo: PlantillaCarnetModel) -> PlantillaCarnet:
    return PlantillaCarnet(
        id=str(modelo.id),
        nombre=modelo.nombre,
        codigo_tipo=modelo.tipo_credencial_id,
        ancho_mm=float(modelo.ancho_mm),
        alto_mm=float(modelo.alto_mm),
        orientacion=modelo.orientacion,
        regla_criterio=modelo.regla_criterio,
        regla_valor=modelo.regla_valor,
        estado=modelo.estado,
        activa=modelo.activa,
        version=modelo.version,
        definicion=modelo.definicion or {},
        creado=str(modelo.created_at) if hasattr(modelo, 'created_at') else "",
        actualizado=str(modelo.updated_at) if hasattr(modelo, 'updated_at') else "",
        plantilla_raiz_id=str(modelo.plantilla_raiz_id) if modelo.plantilla_raiz_id else None,
        creado_por=str(modelo.creado_por_id) if modelo.creado_por_id else None,
        descripcion=modelo.descripcion,
        imagen_url="",
    )


def credencial_externa_a_entidad(modelo: CredencialExternaModel) -> CredencialExterna:
    return CredencialExterna(
        id=str(modelo.pk),
        tipo_credencial=modelo.tipo_credencial_id,
        nombre=modelo.nombre,
        documento=modelo.documento,
        correo=modelo.correo,
        empresa=modelo.empresa,
        contrato=modelo.contrato,
        persona_visitada=modelo.persona_visitada,
        motivo=modelo.motivo,
        vigencia_desde=modelo.vigencia_desde.isoformat() if modelo.vigencia_desde else '',
        vigencia_hasta=modelo.vigencia_hasta.isoformat() if modelo.vigencia_hasta else '',
        estado=modelo.estado,
        security_hash=modelo.security_hash,
        empleado_cedula=modelo.empleado_id,
        observaciones=modelo.observaciones,
        devuelta_en=modelo.devuelta_en.isoformat() if modelo.devuelta_en else None,
        anulada_en=modelo.anulada_en.isoformat() if modelo.anulada_en else None,
        datos=modelo.datos or {},
        plantilla_id=modelo.plantilla_id or None,
        plantilla_version=modelo.plantilla_version,
    )


def carnet_a_entidad(modelo: CarnetEmitidoModel) -> Carnet:
    emp = modelo.employee
    nombres = emp.nombres if emp else ""
    apellidos = emp.apellidos if emp else ""
    return Carnet(
        id=modelo.pk,
        empleado_cedula=str(emp.cedulaidentidad if emp else modelo.employee_id),
        empleado_nombres=nombres,
        empleado_apellidos=apellidos,
        security_hash=modelo.security_hash,
        fecha_emision=str(modelo.fecha_emision),
        motivo_id=modelo.motivo_id,
        motivo_nombre=modelo.motivo.nombre if modelo.motivo else "",
        activo=modelo.activo,
        observaciones=modelo.observaciones,
        plantilla_id=getattr(modelo, 'plantilla_id', None),
        plantilla_version=getattr(modelo, 'plantilla_version', None),
        plantilla_snapshot=getattr(modelo, 'plantilla_snapshot', None),
    )


def plantilla_a_entidad(modelo: CarnetTemplateModel) -> PlantillaCarnet:
    """Compatibilidad con plantilla legacy."""
    return PlantillaCarnet(
        id=modelo.pk,
        nombre=modelo.nombre,
        imagen_url=(
            f"/api/v1/carnetizacion/plantillas/{modelo.pk}/imagen/" if modelo.imagen else ""
        ),
        activa=modelo.activo,
        creado=str(modelo.creado),
    )


def elemento_biblioteca_a_entidad(modelo: ElementoBibliotecaModel) -> ElementoBiblioteca:
    return ElementoBiblioteca(
        id=str(modelo.id),
        nombre=modelo.nombre,
        categoria=modelo.categoria,
        archivo_url=f"/api/v1/carnetizacion/biblioteca/{modelo.id}/archivo/",
        tamano_bytes=modelo.tamano_bytes,
        mime_type=modelo.mime_type,
        ancho_px=modelo.ancho_px,
        alto_px=modelo.alto_px,
        creado=modelo.created_at,
        creado_por=str(modelo.creado_por_id) if modelo.creado_por_id else None,
        descripcion=modelo.descripcion,
    )


def campo_personalizado_a_entidad(modelo: CampoPersonalizadoModel) -> CampoCredencial:
    return CampoCredencial(
        codigo=modelo.codigo,
        etiqueta=modelo.etiqueta,
        grupo=modelo.grupo,  # type: ignore[arg-type]
        tipo_credencial=modelo.tipo_credencial,
        sensible=modelo.sensible,
        es_personalizado=True,
        descripcion=modelo.descripcion,
        valor_ejemplo=modelo.valor_ejemplo,
        origen=modelo.origen,
    )
