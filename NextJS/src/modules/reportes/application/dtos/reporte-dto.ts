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
