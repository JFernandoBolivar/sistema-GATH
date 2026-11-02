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

export interface ReporteItemFamiliar {
  cedulaFamiliar: string;
  nombres: string;
  apellidos: string;
  parentesco: string;
  sexo: string;
  fechaNacimiento: string;
  cedulaEmpleado: string;
}

export interface ReporteItemCodigo {
  codigo: string;
  cargo: string;
  cargoEspecifico: string;
  tipoNomina: string;
  dependencia: string;
  direccionGeneral: string;
  estatus: string;
}

export interface TendenciaPeriodo {
  periodo: string;
  ingresos: number;
  egresos: number;
}

export interface DistribucionNomina {
  tipoNomina: string;
  total: number;
}
