/**
 * DTOs de Reportes (Regla R5).
 */
export interface ReporteItemPersonalDTO {
  cedula: string;
  nombreCompleto: string;
  dependencia: string;
  cargo: string;
  tipoPersonal: string;
  fechaIngreso: string;
  totalAnosApn: number;
}

export interface ReporteItemPasivoDTO {
  cedula: string;
  nombreCompleto: string;
  tipoPersonal: string;
  fechaEgreso: string;
  motivoEgreso: string;
}

export interface ReporteItemVacanteDTO {
  id: number;
  codigoNomina: string | null;
  denominacionCargo: string;
  dependencia: string;
  direccionGeneral: string;
}

export interface ReporteItemFamiliarDTO {
  cedulaFamiliar: string;
  nombres: string;
  apellidos: string;
  parentesco: string;
  sexo: string;
  fechaNacimiento: string;
  cedulaEmpleado: string;
}

export interface ReporteItemCodigoDTO {
  codigo: string;
  cargo: string;
  cargoEspecifico: string;
  tipoNomina: string;
  dependencia: string;
  direccionGeneral: string;
  estatus: string;
}

export interface TendenciaPeriodoDTO {
  periodo: string;
  ingresos: number;
  egresos: number;
}

export interface DistribucionNominaDTO {
  tipoNomina: string;
  total: number;
}
