/**
 * Entidades de Dominio de Carnetización (Regla R1).
 *
 * Alineado a `CarnetSerializer`/`PlantillaCarnetSerializer` reales del
 * backend (Fase 1 del plan de reparación). Nota: no existe todavía emisión
 * real del PDF/QR físico del carnet — `emitirCarnet` solo crea el registro
 * (ver Fase 2.3 del plan de reparación).
 */
export interface Carnet {
  id: number;
  empleadoCedula: string;
  empleadoNombres: string;
  empleadoApellidos: string;
  securityHash: string;
  fechaEmision: string;
  motivoId: number;
  motivoNombre: string;
  activo: boolean;
  observaciones: string | null;
}

export interface PlantillaCarnet {
  id: number;
  nombre: string;
  imagenUrl: string;
  activo: boolean;
  creado: string;
}
