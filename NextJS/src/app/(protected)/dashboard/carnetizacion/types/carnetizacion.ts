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
  imagen_url: string | null;
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
  tamano_total: string;
  ultimos: UltimoCarnet[];
}

export interface VistaPreviaResponse {
  success: boolean;
  vista_previa: string;
}

export interface UploadFotoResponse {
  success: boolean;
  vista_previa: string;
  error?: string;
}

export interface GenerarCarnetPayload {
  motivo_id: number;
  observaciones: string;
  datos_editados: {
    nombre: string;
    cedula: string;
  };
}

export interface RegistrarSolicitudPayload {
  motivo_id: number;
  observaciones: string;
}
