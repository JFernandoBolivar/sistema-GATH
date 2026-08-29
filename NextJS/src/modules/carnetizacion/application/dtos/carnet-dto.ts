/**
 * DTOs de Carnetización (Regla R5).
 */
export interface CarnetDTO {
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

export interface PlantillaCarnetDTO {
  id: number;
  nombre: string;
  imagenUrl: string;
  activo: boolean;
  creado: string;
}

export interface ValidacionCarnetDTO {
  esValido: boolean;
  mensaje: string;
  carnet: CarnetDTO | null;
}
