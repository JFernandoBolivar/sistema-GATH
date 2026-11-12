/**
 * Entidades y tipos para Eventos, Invitados y Control de Entrada QR (O45-B).
 */

export type EstadoEvento = 'activo' | 'finalizado' | 'cancelado' | 'borrador';

export type EstadoInvitado = 'registrado' | 'emitido' | 'ingreso' | 'anulado';

export type ResultadoCheckIn = 'ACCESO_PERMITIDO' | 'YA_INGRESO' | 'NO_VALIDA';

export interface EventoCategoria {
  id: string;
  evento_id: string;
  nombre: string;
  color_primario: string;
  color_acento: string;
  orden: number;
  plantilla_id?: string | null;
}

export interface EventoZona {
  id: string;
  evento_id: string;
  nombre: string;
  codigo: string;
  orden: number;
}

export interface Evento {
  id: string;
  nombre: string;
  lugar: string;
  fecha_inicio: string;
  fecha_fin: string;
  descripcion?: string;
  estado: EstadoEvento | string;
  plantilla_id?: string | null;
  creado_por_id?: number | null;
  created_at?: string;
  updated_at?: string;
  categorias?: EventoCategoria[];
  zonas?: EventoZona[];
  total_invitados?: number;
  total_entraron?: number;
}

export interface EventoInvitado {
  id: string;
  evento_id: string;
  nombre_completo: string;
  categoria_id: string;
  zona_id: string;
  categoria_nombre?: string;
  zona_nombre?: string;
  documento_identidad?: string;
  organizacion?: string;
  correo?: string;
  telefono?: string;
  mesa?: string;
  codigo_credencial?: string;
  security_hash?: string;
  es_acompanante?: boolean;
  trabajador_titular_id?: number | null;
  trabajador_titular_nombre?: string | null;
  estado: EstadoInvitado | string;
  fecha_emision?: string | null;
  fecha_ingreso?: string | null;
  hora_ingreso_formateada?: string | null;
  observaciones?: string;
  created_at?: string;
}

export interface InvitadoImportarFila {
  fila: number;
  nombre_completo: string;
  categoria_nombre: string;
  zona_nombre: string;
  documento_identidad?: string;
  organizacion?: string;
  correo?: string;
  telefono?: string;
  mesa?: string;
  valida: boolean;
  error?: string;
}

export interface ResumenImportacion {
  total_filas: number;
  filas_validas: number;
  filas_invalidas: number;
  filas: InvitadoImportarFila[];
}

export interface CheckInResponse {
  resultado: ResultadoCheckIn;
  mensaje: string;
  invitado_id?: string | null;
  nombre_completo?: string | null;
  documento_identidad?: string | null;
  organizacion?: string | null;
  categoria_nombre?: string | null;
  zona_nombre?: string | null;
  mesa?: string | null;
  codigo_credencial?: string | null;
  hora_ingreso_formateada?: string | null;
}

export interface PanelEvento {
  evento_id: string;
  nombre_evento: string;
  lugar: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  total_invitados: number;
  credenciales_emitidas: number;
  entraron: number;
  faltan: number;
  porcentaje_asistencia: number;
  por_categoria: Record<string, number>;
  por_zona: Record<string, number>;
}

/** Totales reales de todos los eventos (no de la página). */
export interface ResumenEventos {
  eventos: number;
  en_curso: number;
  proximos: number;
  invitados: number;
  ingresos: number;
}

/** Página de eventos (paginada en el servidor). */
export interface PaginaEventos {
  resultados: Evento[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
  resumen: ResumenEventos;
}

/** Página de invitados de un evento (paginada en el servidor). */
export interface PaginaInvitados {
  resultados: EventoInvitado[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}

/** Filtros del listado de invitados; los aplica el servidor. */
export interface FiltrosInvitados {
  categoria_id?: string;
  zona_id?: string;
  estado?: string;
  busqueda?: string;
  pagina?: number;
  page_size?: number;
}

export type PoblacionInvitable = "TODOS" | "ACTIVOS" | "PASIVOS";

/** Tope de invitados por operación en bloque (espejo del backend). */
export const TOPE_AGREGAR_EN_BLOQUE = 2000;

/** Persona registrada (trabajador o credencial externa) que puede invitarse a un evento. */
export interface PersonaInvitable {
  tipo: "TRABAJADOR" | "EXTERNO";
  clave: string;
  nombre: string;
  documento: string;
  cargo: string;
  dependencia: string;
  condicion: string;
  foto_url: string;
  ya_invitado: boolean;
}

export interface PaginaPersonasInvitables {
  resultados: PersonaInvitable[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}

export interface FiltroPersonalInvitable {
  poblacion: PoblacionInvitable;
  dependencia_id?: number;
  busqueda?: string;
  pagina?: number;
  page_size?: number;
}

export interface SolicitudAgregarEnBloque {
  categoria_id: string;
  zona_id: string;
  poblacion?: PoblacionInvitable;
  dependencia_id?: number;
  cedulas?: string[];
  externos_ids?: string[];
}

export interface ResultadoAgregarEnBloque {
  agregados: number;
  duplicados: number;
  solicitados: number;
}
