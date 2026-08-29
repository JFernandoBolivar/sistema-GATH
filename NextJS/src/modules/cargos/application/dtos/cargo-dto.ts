/**
 * DTOs de Cargos (Regla R5).
 */
export interface DenominacionCargoDTO {
  id: number;
  nombre: string;
}

export interface CargoAsignacionDTO {
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
