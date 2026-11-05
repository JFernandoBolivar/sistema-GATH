"""
Mapper ORM -> Entidad de Punto de Cuenta, resolviendo los nombres de
empleado/dependencias/motivo/oficinas/divisiones (joins de lectura tolerantes).
"""
from apps.catalogos.infrastructure.models.catalogo_models import TipoMovimientoModel
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
    DireccionLineaModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.puntocuenta.domain.entities.punto_cuenta import PuntoCuenta


def _nombre_dependencia(dependencia_id: int | None) -> str | None:
    if not dependencia_id:
        return None
    fila = DependenciaModel.objects.filter(pk=dependencia_id).first()
    return fila.dependencia if fila else None


def _nombre_oficina(oficina_id: int | None) -> str | None:
    if not oficina_id:
        return None
    fila = DireccionGeneralModel.objects.filter(pk=oficina_id).first()
    return fila.direccion_general if fila else None


def _nombre_division(division_id: int | None) -> str | None:
    if not division_id:
        return None
    fila = DireccionLineaModel.objects.filter(pk=division_id).first()
    return fila.direccion_linea if fila else None


def _nombre_empleado(cedula: str) -> str | None:
    fila = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
    return f"{fila.nombres} {fila.apellidos}".strip() if fila else None


def _nombre_motivo(motivo_id: int | None) -> str | None:
    if not motivo_id:
        return None
    fila = TipoMovimientoModel.objects.filter(pk=motivo_id).first()
    return fila.movimiento if fila else None


def _info_cargo(cargo_id: int | None) -> tuple[str | None, str | None]:
    if not cargo_id:
        return None, None
    asig = AsigTrabajoModel.objects.filter(pk=cargo_id).select_related('denominacion_cargo').first()
    if not asig:
        return str(cargo_id), None
    codigo = asig.codigo
    denominacion = asig.denominacion_cargo.cargo if asig.denominacion_cargo else None
    return codigo, denominacion


def a_entidad(modelo) -> PuntoCuenta:
    cargo_cod, cargo_nom = _info_cargo(modelo.cargo_id)
    return PuntoCuenta(
        id=str(modelo.pk),
        cargo_id=modelo.cargo_id,
        empleado_cedula=modelo.empleado_cedula,
        empleado_nombre=_nombre_empleado(modelo.empleado_cedula),
        dependencia_origen_id=modelo.dependencia_origen_id,
        dependencia_origen_nombre=_nombre_dependencia(modelo.dependencia_origen_id),
        dependencia_destino_id=modelo.dependencia_destino_id,
        dependencia_destino_nombre=_nombre_dependencia(modelo.dependencia_destino_id),
        motivo_id=modelo.motivo_id,
        motivo_nombre=_nombre_motivo(modelo.motivo_id),
        usuario_id=modelo.usuario_id,
        fecha=modelo.fecha.isoformat(),
        documento_pdf_clave=modelo.documento_pdf_clave,
        oficina_origen_id=modelo.oficina_origen_id,
        oficina_origen_nombre=_nombre_oficina(modelo.oficina_origen_id),
        oficina_destino_id=modelo.oficina_destino_id,
        oficina_destino_nombre=_nombre_oficina(modelo.oficina_destino_id),
        division_origen_id=getattr(modelo, 'division_origen_id', None),
        division_origen_nombre=_nombre_division(getattr(modelo, 'division_origen_id', None)),
        division_destino_id=getattr(modelo, 'division_destino_id', None),
        division_destino_nombre=_nombre_division(getattr(modelo, 'division_destino_id', None)),
        numero=getattr(modelo, 'numero', None),
        anio=getattr(modelo, 'anio', None),
        secuencia=getattr(modelo, 'secuencia', None),
        cargo_codigo=cargo_cod,
        cargo_nombre=cargo_nom,
        configuracion_version=getattr(modelo, 'configuracion_version', None),
        snapshot_formato=getattr(modelo, 'snapshot_formato', None),
    )
