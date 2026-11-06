/**
 * Mappers para convertir datos de Reportes a entidades de dominio.
 */
import type {
  DistribucionNomina,
  ReporteItemCodigo,
  ReporteItemFamiliar,
  ReporteItemPasivo,
  ReporteItemPersonal,
  ReporteItemVacante,
  TendenciaPeriodo,
} from "../../domain/entities/reporte";
import type {
  DistribucionNominaApiItem,
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
    sinFechaApn: Boolean(raw.apn_aviso),
  };
}

export function reportePasivoApiAEntidad(raw: ReportePasivoApiItem): ReporteItemPasivo {
  const nombreCompleto =
    raw.nombre_completo || [raw.nombres, raw.apellidos].filter(Boolean).join(" ");
  const tipoPasivo = raw.tipo_pasivo || raw.tipo_personal || "Pasivo";
  return {
    cedula: raw.cedula,
    nombreCompleto,
    nombres: raw.nombres,
    apellidos: raw.apellidos,
    tipoPersonal: tipoPasivo,
    tipoPasivo,
    fechaEgreso: raw.fecha_egreso || "N/A",
    motivoEgreso: raw.motivo_egreso || "",
    contacto: raw.contacto || "S/D",
    estadoFeDeVida: raw.estado_fe_de_vida || "S/D",
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

export function distribucionNominaApiAEntidad(raw: DistribucionNominaApiItem): DistribucionNomina {
  return {
    tipoNomina: raw.tipo_nomina,
    total: raw.total,
  };
}
