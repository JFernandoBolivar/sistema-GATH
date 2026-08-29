/**
 * Entidades de Dominio de Cargos (Regla R1).
 */
export interface DenominacionCargo {
  id: number;
  nombre: string;
}

export interface CargoAsignacion {
  id: number;
  codigoNomina: string | null;
  empleadoCedula: string | null;
  empleadoNombre: string | null;
  denominacionCargoId: number;
  denominacionCargoNombre: string;
  dependenciaId: number | null;
  dependenciaNombre: string | null;
  direccionGeneralId: number | null;
  direccionGeneralNombre: string | null;
  activo: boolean;
  estaVacante: boolean;
}
