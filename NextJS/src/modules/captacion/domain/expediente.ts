/**
 * Tipos y reglas de presentación de la bandeja de Captación (D-7/D-8).
 *
 * Aquí NO viven las reglas de la máquina de estados: las acciones disponibles salen del backend
 * (`acciones[]`) y la interfaz solo las dibuja.
 */

export type TonoEstado = "success" | "warning" | "danger" | "info" | "neutral";

export interface DescripcionEstado {
  etiqueta: string;
  tono: TonoEstado;
}

const ESTADOS: Record<string, DescripcionEstado> = {
  PRE_REGISTRADO: { etiqueta: "Registrado", tono: "neutral" },
  EN_CAPTURA: { etiqueta: "El postulante captura datos", tono: "info" },
  ENVIADO_CAPTACION: { etiqueta: "Por revisar", tono: "warning" },
  EN_CORRECCION_DATOS: { etiqueta: "Devuelto al postulante", tono: "warning" },
  RECHAZADO_CAPTACION: { etiqueta: "Rechazado por Captación", tono: "danger" },
  EN_PRESUPUESTO: { etiqueta: "En Presupuesto", tono: "info" },
  EN_CORRECCION_CARGO: { etiqueta: "Cargo por corregir", tono: "warning" },
  DIFERIDO_PRESUPUESTO: { etiqueta: "Diferido por Presupuesto", tono: "warning" },
  EN_DIRECCION_GENERAL: { etiqueta: "En Dirección General", tono: "info" },
  RECHAZADO_DIRECCION: { etiqueta: "Rechazado por Dirección", tono: "danger" },
  APROBADO: { etiqueta: "Aprobado", tono: "success" },
  CONSOLIDANDO: { etiqueta: "Completando expediente", tono: "info" },
  EN_REVISION_FINAL: { etiqueta: "Revisión final", tono: "warning" },
  LISTO_PARA_ASIGNAR: { etiqueta: "Listo para asignar", tono: "success" },
  CONTRATADO: { etiqueta: "Contratado", tono: "success" },
  EXPIRADO: { etiqueta: "Plazo vencido", tono: "danger" },
  DESISTIDO: { etiqueta: "Desistido", tono: "neutral" },
};

/** Etiqueta en lenguaje claro y tono de la insignia de un estado (los desconocidos se muestran tal cual). */
export function describirEstado(estado: string): DescripcionEstado {
  return ESTADOS[estado] ?? { etiqueta: estado, tono: "neutral" };
}

export type PestanaBandeja = "por_revisar" | "en_correccion" | "en_presupuesto" | "todos";

export interface DefinicionPestana {
  id: PestanaBandeja;
  etiqueta: string;
  /** Estados que filtra la pestaña (vacío = todos). */
  estados: string[];
}

export const PESTANAS: DefinicionPestana[] = [
  { id: "por_revisar", etiqueta: "Por revisar", estados: ["ENVIADO_CAPTACION", "EN_REVISION_FINAL"] },
  { id: "en_correccion", etiqueta: "En corrección", estados: ["EN_CORRECCION_DATOS", "EN_CORRECCION_CARGO"] },
  { id: "en_presupuesto", etiqueta: "En Presupuesto", estados: ["EN_PRESUPUESTO", "DIFERIDO_PRESUPUESTO"] },
  { id: "todos", etiqueta: "Todos", estados: [] },
];

export function estadosDePestana(id: PestanaBandeja): string[] {
  return PESTANAS.find((p) => p.id === id)?.estados ?? [];
}

// --- Bandeja ---
export interface PostulanteResumen {
  cedula: string;
  nombres: string;
  apellidos: string;
}

export interface FilaBandeja {
  id: string;
  numero: string;
  estado: string;
  ventana: number | null;
  venceEl: string | null;
  ultimoCambio: string | null;
  esReingreso: boolean;
  pendienteDeCaptacion: boolean;
  postulante: PostulanteResumen;
}

export interface PaginaBandeja {
  resultados: FilaBandeja[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}

export interface FiltrosBandeja {
  estados: string[];
  q?: string;
  desde?: string;
  hasta?: string;
  pagina: number;
  tamano: number;
}

// --- Detalle ---
export interface AccionExpediente {
  destino: string;
  etiqueta: string;
  requiereMotivo: boolean;
  requierePropuesta: boolean;
  bloqueada: boolean;
  motivoBloqueo: string;
  sugerida: boolean;
}

export interface HitoHistorial {
  estadoOrigen: string | null;
  estadoDestino: string;
  fecha: string;
  actorCedula: string;
  actorTipo: string;
  motivo: string;
}

export interface ResultadoPsicofisico {
  resultado: "APTO" | "NO_APTO" | null;
  obligatorio: boolean;
  fechaAplicacion: string | null;
  observaciones: string;
  tieneInforme: boolean;
  informeTamano: number | null;
  registradoPor: string | null;
  registradoEl: string | null;
  sugiereRechazo: boolean;
}

export interface PropuestaCargo {
  cargoId: number | null;
  cargoEspecificoId: number | null;
  tipoNominaId: number | null;
  direccionGeneralId: number | null;
  direccionLineaId: number | null;
  coordinacionId: number | null;
  dependenciaId: number | null;
  cargoTexto: string;
  oficinaTexto: string;
}

export interface DetalleExpediente {
  expediente: {
    id: string;
    numero: string;
    estado: string;
    ventana: number | null;
    venceEl: string | null;
    fechaApertura: string | null;
    fechaCierre: string | null;
    observaciones: string;
    esReingreso: boolean;
    propuesta: PropuestaCargo;
  };
  postulante: {
    id: string;
    cedula: string;
    nombres: string;
    apellidos: string;
    correo: string;
    telefonoMovil: string;
    esReingreso: boolean;
  };
  datosVentana1: Record<string, unknown>;
  historial: HitoHistorial[];
  psicofisico: ResultadoPsicofisico;
  acciones: AccionExpediente[];
}

// --- Credencial (se muestra UNA vez) ---
export interface CredencialEmitida {
  usuario: string;
  claveTemporal: string;
  ventana: number | null;
  venceEl: string | null;
  debeCambiarClave: boolean;
}

export interface AltaPostulanteResultado {
  expedienteId: string;
  numero: string;
  esReingreso: boolean;
  credencial: CredencialEmitida;
  mensaje: string;
}

export interface DatosAltaPostulante {
  cedula: string;
  nombres: string;
  apellidos: string;
  correo?: string;
  telefonoMovil?: string;
}

/** Cuerpo `datos` de la transición hacia Presupuesto (claves del backend). */
export interface DatosPropuesta {
  cargo_id?: number;
  cargo_especifico_id?: number;
  tipo_nomina_id?: number;
  direccion_general_id?: number;
  direccion_linea_id?: number;
  coordinacion_id?: number;
  dependencia_id?: number;
  cargo_texto?: string;
  oficina_texto?: string;
  observaciones?: string;
}

export interface DatosTransicion {
  destino: string;
  motivo?: string;
  datos?: DatosPropuesta;
}

export interface DatosPsicofisico {
  resultado: "APTO" | "NO_APTO";
  fechaAplicacion: string;
  observaciones?: string;
}

/** Resultado uniforme de las Server Actions: el motivo llega en español, sin lanzar al navegador. */
export type ResultadoAccion<T> =
  | { ok: true; data: T; mensaje?: string }
  | { ok: false; error: string; errores?: Record<string, string[]> };
