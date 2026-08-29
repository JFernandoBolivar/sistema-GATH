/**
 * Mappers para convertir datos de Reportes a entidades de dominio.
 */
import type {
  ReporteItemPasivo,
  ReporteItemPersonal,
  ReporteItemVacante,
} from "../../domain/entities/reporte";
import type {
  ReportePasivoApiItem,
  ReportePersonalApiItem,
  ReporteVacanteApiItem,
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
