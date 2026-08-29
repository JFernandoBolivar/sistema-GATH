/**
 * Entidades de Dominio de Reportes (Regla R1).
 */
export interface ReporteItemPersonal {
  cedula: string;
  nombreCompleto: string;
  dependencia: string;
  cargo: string;
  tipoPersonal: string;
  fechaIngreso: string;
  totalAnosApn: number;
}

export interface ReporteItemPasivo {
  cedula: string;
  nombreCompleto: string;
  tipoPersonal: string;
  fechaEgreso: string;
  motivoEgreso: string;
}

export interface ReporteItemVacante {
  id: number;
  codigoNomina: string | null;
  denominacionCargo: string;
  dependencia: string;
  direccionGeneral: string;
}
