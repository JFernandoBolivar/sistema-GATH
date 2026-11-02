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

export interface EstadisticaMotivoCarnetDTO {
  motivoId: number;
  motivo: string;
  total: number;
}

export interface EstadisticasCarnetDTO {
  total: number;
  activos: number;
  revocados: number;
  emitidosHoy: number;
  emitidosMes: number;
  porMotivo: EstadisticaMotivoCarnetDTO[];
}

export interface DatosCarnetEmpleadoDTO {
  cedula: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  codigo?: string;
  cargo?: string;
  departamento?: string;
  fotoUrl?: string | null;
}

export interface VistaPreviaCarnetDTO {
  cedula: string;
  nombreCompleto: string;
  codigo?: string;
  cargo?: string;
  departamento?: string;
  fotoUrl?: string | null;
  plantillaUrl?: string | null;
  htmlVistaPrevia: string;
}
