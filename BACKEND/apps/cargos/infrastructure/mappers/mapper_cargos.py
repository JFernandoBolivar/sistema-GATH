"""
Mappers de Cargos.
"""
from apps.cargos.domain.entities.cargo_asignacion import CargoAsignacion
from apps.cargos.domain.entities.denominacion_cargo import DenominacionCargo
from apps.cargos.domain.entities.denominacion_especifica import DenominacionEspecifica
from apps.cargos.domain.entities.prestamo_cargo import PrestamoCargo
from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.cargos.infrastructure.models.prestamo_models import PrestamoCargoModel


def denominacion_a_entidad(modelo: DenominacionCargoModel) -> DenominacionCargo:
    return DenominacionCargo(
        id=modelo.pk,
        nombre=modelo.cargo,
        orden=modelo.orden_by_cargo,
    )


def denominacion_especifica_a_entidad(
    modelo: DenominacionCargoEspecificoModel,
) -> DenominacionEspecifica:
    return DenominacionEspecifica(
        id=modelo.pk,
        nombre=modelo.cargo,
        orden=modelo.orden_by_cargo,
    )


def cargo_asignacion_a_entidad(modelo: AsigTrabajoModel) -> CargoAsignacion:
    empleado_nom = None
    if modelo.employee:
        empleado_nom = f"{modelo.employee.nombres} {modelo.employee.apellidos}".strip()
    return CargoAsignacion(
        id=modelo.pk,
        codigo=modelo.codigo,
        empleado_cedula=str(modelo.employee_id) if modelo.employee_id else None,
        empleado_nombre=empleado_nom,
        denominacion_id=modelo.denominacioncargoid_id,
        denominacion_nombre=modelo.denominacioncargoid.cargo if modelo.denominacioncargoid else "",
        especifica_id=modelo.denominacioncargoespecificoid_id,
        especifica_nombre=modelo.denominacioncargoespecificoid.cargo if modelo.denominacioncargoespecificoid else "",
        tipo_nomina_id=modelo.tiponominaid_id,
        tipo_nomina_nombre=modelo.tiponominaid.nomina if modelo.tiponominaid else "",
        estatus_id=modelo.estatusid_id,
        estatus_nombre=modelo.estatusid.estatus if modelo.estatusid else "",
        dependencia_id=modelo.Dependencia_id,
        dependencia_nombre=modelo.Dependencia.dependencia if modelo.Dependencia else None,
        direccion_general_id=modelo.DireccionGeneral_id,
        direccion_general_nombre=modelo.DireccionGeneral.direccion_general if modelo.DireccionGeneral else None,
        direccion_linea_id=modelo.DireccionLinea_id,
        direccion_linea_nombre=modelo.DireccionLinea.direccion_linea if modelo.DireccionLinea else None,
        coordinacion_id=modelo.Coordinacion_id,
        coordinacion_nombre=modelo.Coordinacion.coordinacion if modelo.Coordinacion else None,
        organismo_id=modelo.OrganismoAdscritoid_id,
        organismo_nombre=modelo.OrganismoAdscritoid.Organismoadscrito if modelo.OrganismoAdscritoid else None,
        grado_id=modelo.gradoid_id,
        grado_nombre=modelo.gradoid.grado if modelo.gradoid else None,
        observaciones=modelo.observaciones,
        fecha_actualizacion=modelo.fecha_actualizacion.isoformat() if getattr(modelo, 'fecha_actualizacion', None) else None,
    )


def prestamo_a_entidad(modelo: PrestamoCargoModel) -> PrestamoCargo:
    cargo = modelo.cargo_encargado
    titular = cargo.employee if cargo and cargo.employee_id else None
    return PrestamoCargo(
        id=modelo.pk,
        empleado_encargado_cedula=modelo.empleado_encargado_id,
        empleado_encargado_nombre=f"{modelo.empleado_encargado.nombres} {modelo.empleado_encargado.apellidos}".strip(),
        cargo_encargado_id=modelo.cargo_encargado_id,
        cargo_encargado_codigo=cargo.codigo if cargo else '',
        cargo_encargado_denominacion=cargo.denominacioncargoid.cargo if cargo and cargo.denominacioncargoid else '',
        titular_cedula=titular.cedulaidentidad if titular else None,
        titular_nombre=f"{titular.nombres} {titular.apellidos}".strip() if titular else None,
        motivo_id=modelo.motivo_id,
        motivo_nombre=modelo.motivo.movimiento,
        estatus_id=modelo.estatus_id,
        estatus_nombre=modelo.estatus.estatus,
        fecha_inicio=modelo.fecha_inicio.isoformat(),
        fecha_fin=modelo.fecha_fin.isoformat(),
        ejecutado_por_id=modelo.ejecutado_por_id,
    )
