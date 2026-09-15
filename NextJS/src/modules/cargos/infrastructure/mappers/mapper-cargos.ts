/**
 * Mappers para convertir datos de Cargos a entidades de dominio.
 */
import type {
  CargoAsignacion,
  CatalogoCargoItem,
  DenominacionCargo,
  PrestamoCargo,
  UnidadOrganizativaCargo,
} from "../../domain/entities/cargo";
import type {
  CargoApiItem,
  CatalogoApiItem,
  DenominacionApiItem,
  PrestamoApiItem,
  UnidadOrganizativaApiItem,
} from "../http/cargos-api";

export function cargoApiAEntidad(raw: CargoApiItem): CargoAsignacion {
  return {
    id: raw.id,
    codigo: raw.codigo,
    empleadoCedula: raw.empleado_cedula,
    denominacionId: raw.denominacion_id,
    denominacionNombre: raw.denominacion_nombre,
    especificaId: raw.especifica_id,
    especificaNombre: raw.especifica_nombre,
    tipoNominaId: raw.tipo_nomina_id,
    tipoNominaNombre: raw.tipo_nomina_nombre,
    estatusId: raw.estatus_id,
    estatusNombre: raw.estatus_nombre,
    dependenciaId: raw.dependencia_id,
    dependenciaNombre: raw.dependencia_nombre,
    direccionGeneralId: raw.direccion_general_id,
    direccionGeneralNombre: raw.direccion_general_nombre,
    direccionLineaId: raw.direccion_linea_id,
    direccionLineaNombre: raw.direccion_linea_nombre,
    coordinacionId: raw.coordinacion_id,
    coordinacionNombre: raw.coordinacion_nombre,
    observaciones: raw.observaciones,
    estaVacante: raw.esta_vacante,
  };
}

export function denominacionApiAEntidad(raw: DenominacionApiItem): DenominacionCargo {
  return { id: raw.id, nombre: raw.nombre, orden: raw.orden };
}

export function prestamoApiAEntidad(raw: PrestamoApiItem): PrestamoCargo {
  return {
    id: raw.id,
    empleadoEncargadoCedula: raw.empleado_encargado_cedula,
    empleadoEncargadoNombre: raw.empleado_encargado_nombre,
    cargoEncargadoId: raw.cargo_encargado_id,
    cargoEncargadoCodigo: raw.cargo_encargado_codigo,
    titularCedula: raw.titular_cedula,
    titularNombre: raw.titular_nombre,
    motivoId: raw.motivo_id,
    motivoNombre: raw.motivo_nombre,
    estatusId: raw.estatus_id,
    estatusNombre: raw.estatus_nombre,
    fechaInicio: raw.fecha_inicio,
    fechaFin: raw.fecha_fin,
    ejecutadoPorId: raw.ejecutado_por_id,
    estaFinalizada: raw.esta_finalizada,
  };
}

export function catalogoApiAEntidad(raw: CatalogoApiItem): CatalogoCargoItem {
  return { id: raw.id, nombre: raw.nombre };
}

export function unidadOrganizativaApiAEntidad(raw: UnidadOrganizativaApiItem): UnidadOrganizativaCargo {
  return { id: raw.id, codigo: raw.codigo, nombre: raw.nombre };
}
