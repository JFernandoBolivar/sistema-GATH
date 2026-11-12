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
  ultimos?: UltimoCarnet[];
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
  /** ISO de la emisión del carnet vigente; null si no tiene. */
  carnet_activo_emitido_en?: string | null;
}

export interface MotivoOption {
  id: number;
  nombre: string;
}

export interface TipoCredencial {
  codigo: string;
  nombre: string;
  descripcion: string;
  ancho_mm: number;
  alto_mm: number;
  orientacion: "vertical" | "horizontal";
  grupo: string;
  activo: boolean;
  orden: number;
}

export interface PlantillaMotor {
  id: string;
  nombre: string;
  codigo_tipo: string;
  ancho_mm: number;
  alto_mm: number;
  orientacion: "vertical" | "horizontal";
  regla_criterio: string;
  regla_valor: string;
  estado: "borrador" | "publicada" | "archivada";
  activa: boolean;
  version: number;
  definicion: Record<string, unknown>;
  creado: string;
  actualizado: string;
  plantilla_raiz_id?: string | null;
  creado_por?: string | null;
  descripcion?: string;
  imagen_url?: string;
}

export type CategoriaBiblioteca = "logo" | "firma" | "imagen";

export interface ElementoBiblioteca {
  id: string;
  nombre: string;
  categoria: CategoriaBiblioteca;
  archivo_url: string;
  tamano_bytes: number;
  mime_type: string;
  ancho_px: number | null;
  alto_px: number | null;
  creado: string;
  creado_por?: string | null;
  descripcion?: string | null;
}

export type GrupoCampo =
  | "identificacion"
  | "laboral"
  | "salud_emergencia"
  | "emision"
  | "personalizado";

export interface CampoCredencial {
  codigo: string;
  etiqueta: string;
  grupo: GrupoCampo;
  tipo_credencial: string;
  sensible: boolean;
  es_personalizado: boolean;
  descripcion: string;
  valor_ejemplo: string;
  /** Solo en personalizados: de dónde sale el valor al imprimir. Vacío = campo viejo sin origen. */
  origen?: string;
}

export interface Plantilla {
  id: number | string;
  nombre: string;
  imagen_url?: string | null;
  imagenUrl?: string | null;
  activo: boolean;
  creado: string;
}

/** Página de resultados paginada en el servidor ({resultados, total, pagina, tamano, total_paginas}). */
export interface PaginaCarnet<T> {
  resultados: T[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}

/** Parámetros de paginación y búsqueda que viajan al servidor. */
export interface ParamsPagina {
  pagina: number;
  tamano: number;
  busqueda?: string;
}

export const TAMANOS_PAGINA = [12, 24, 48] as const;

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

// --- QR y Privacidad por Dato (O44 - E9) ---

export interface ContactoEmergenciaQr {
  nombre: string;
  parentesco: string;
  telefono: string;
}

export interface SaludFichaQr {
  alergias: string[];
  patologias: string[];
  discapacidades: string[];
  grupo_sanguineo?: string;
}

export interface DatosFichaQr {
  nombre: string;
  foto_url?: string;
  cargo: string;
  codigo_cargo?: string;
  ubicacion: string;
  cedula?: string | null;
  fecha_nacimiento?: string | null;
  contactos_emergencia: ContactoEmergenciaQr[];
  salud?: SaludFichaQr | null;
  direccion_vivienda?: string;
  expediente_completo_autorizado?: boolean;
}

export interface FichaQr {
  esValido: boolean;
  estado: "VIGENTE" | "ANULADO" | "VENCIDO" | "NO_REGISTRADO";
  mensaje: string;
  securityHash?: string | null;
  nivelAcceso: "PUBLICO" | "CON_SESION" | "ADMINISTRADOR";
  datos: DatosFichaQr | null;
  saludDisponible: boolean;
  fechaEmision?: string | null;
  fechaVencimiento?: string | null;
}

export type NivelPrivacidadDato = "PUBLICO" | "CON_SESION" | "SOLO_PERSONAL";

export interface PreferenciasPrivacidadCarnet {
  foto?: NivelPrivacidadDato;
  nombre?: NivelPrivacidadDato;
  cargo?: NivelPrivacidadDato;
  ubicacion?: NivelPrivacidadDato;
  contactos_emergencia?: NivelPrivacidadDato;
  salud?: NivelPrivacidadDato;
  cedula?: NivelPrivacidadDato;
  fecha_nacimiento?: NivelPrivacidadDato;
  direccion_vivienda?: NivelPrivacidadDato;
  [key: string]: NivelPrivacidadDato | undefined;
}

export const PRIVACIDAD_DEFECTO: PreferenciasPrivacidadCarnet = {
  foto: "PUBLICO",
  nombre: "PUBLICO",
  cargo: "PUBLICO",
  ubicacion: "PUBLICO",
  contactos_emergencia: "PUBLICO",
  salud: "PUBLICO",
  cedula: "CON_SESION",
  fecha_nacimiento: "CON_SESION",
  direccion_vivienda: "SOLO_PERSONAL",
};

