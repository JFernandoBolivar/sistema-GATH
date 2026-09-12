/**
 * Mappers para convertir datos de Reportes a entidades de dominio.
 */
import type {
  ReporteItemCodigo,
  ReporteItemFamiliar,
  ReporteItemPasivo,
  ReporteItemPersonal,
  ReporteItemVacante,
  TendenciaPeriodo,
} from "../../domain/entities/reporte";
import type {
  ReporteCodigoApiItem,
  ReporteFamiliarApiItem,
  ReportePasivoApiItem,
  ReportePersonalApiItem,
  ReporteVacanteApiItem,
  TendenciaApiItem,
} from "../http/reportes-api";

export function reportePersonalApiAEntidad(raw: ReportePersonalApiItem): ReporteItemPersonal {
  return {
    cedula: raw.cedula,
    nombreCompleto: raw.nombre_completo,
    dependencia: raw.dependencia,
    cargo: raw.cargo,
    tipoPersonal: raw.tipo_personal,
    fechaIngreso: raw.fecha_ingreso,
    totalAnosApn: raw.total_anos_apn,
  };
}

export function reportePasivoApiAEntidad(raw: ReportePasivoApiItem): ReporteItemPasivo {
  return {
    cedula: raw.cedula,
    nombreCompleto: raw.nombre_completo,
    tipoPersonal: raw.tipo_personal,
    fechaEgreso: raw.fecha_egreso,
    motivoEgreso: raw.motivo_egreso,
  };
}

export function reporteVacanteApiAEntidad(raw: ReporteVacanteApiItem): ReporteItemVacante {
  return {
    id: raw.id,
    codigoNomina: raw.codigo_nomina,
    denominacionCargo: raw.denominacion_cargo,
    dependencia: raw.dependencia,
    direccionGeneral: raw.direccion_general,
  };
}

export function reporteFamiliarApiAEntidad(raw: ReporteFamiliarApiItem): ReporteItemFamiliar {
  return {
    cedulaFamiliar: raw.cedula_familiar,
    nombres: raw.nombres,
    apellidos: raw.apellidos,
    parentesco: raw.parentesco,
    sexo: raw.sexo,
    fechaNacimiento: raw.fecha_nacimiento,
    cedulaEmpleado: raw.cedula_empleado,
  };
}

export function reporteCodigoApiAEntidad(raw: ReporteCodigoApiItem): ReporteItemCodigo {
  return {
    codigo: raw.codigo,
    cargo: raw.cargo,
    cargoEspecifico: raw.cargo_especifico,
    tipoNomina: raw.tipo_nomina,
    dependencia: raw.dependencia,
    direccionGeneral: raw.direccion_general,
    estatus: raw.estatus,
  };
}

export function tendenciaApiAEntidad(raw: TendenciaApiItem): TendenciaPeriodo {
  return {
    periodo: raw.periodo,
    ingresos: raw.ingresos,
    egresos: raw.egresos,
  };
}
