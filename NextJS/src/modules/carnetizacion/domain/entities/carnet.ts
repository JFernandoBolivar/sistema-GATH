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

export interface EstadisticaMotivoCarnet {
  motivoId: number;
  motivo: string;
  total: number;
}

export interface EstadisticasCarnet {
  total: number;
  activos: number;
  revocados: number;
  emitidosHoy: number;
  emitidosMes: number;
  porMotivo: EstadisticaMotivoCarnet[];
}

export interface DatosCarnetEmpleado {
  cedula: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  codigo?: string;
  cargo?: string;
  departamento?: string;
  fotoUrl?: string | null;
}

export interface VistaPreviaCarnetDatos {
  cedula: string;
  nombreCompleto: string;
  codigo?: string;
  cargo?: string;
  departamento?: string;
  fotoUrl?: string | null;
  plantillaUrl?: string | null;
}

export interface EmployeeCarnet {
  id: number;
  cedula: string;
  nombre_completo: string;
  cargo: string;
  departamento: string;
  codigo: string;
  correo: string;
  telefono: string;
  total_solicitudes: number;
  tiene_carnet: boolean;
}

export interface MotivoOption {
  id: number;
  nombre: string;
}

export interface Plantilla {
  id: number;
  nombre: string;
  imagen_url?: string | null;
  imagenUrl?: string | null;
  activo: boolean;
  creado: string;
}

export interface UltimoCarnet {
  nombre: string;
  cedula: string;
  fecha: string;
  motivo: string;
  activo: boolean;
}

export interface EstadisticasData {
  total: number;
  activos: number;
  hoy: number;
  this_month: number;
  tamano_total?: string;
  ultimos: UltimoCarnet[];
  por_motivo?: { motivo_id: number; motivo: string; total: number }[];
}

export interface VistaPreviaResponse {
  success: boolean;
  vista_previa: string;
}

export interface UploadFotoResponse {
  success: boolean;
  vista_previa: string;
  error?: string;
  filename?: string;
  message?: string;
}

