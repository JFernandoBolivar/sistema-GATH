/** DTOs del módulo postulación (camelCase). El backend usa snake_case: ver `mapper-postulacion.ts`. */

export interface ExpedienteDTO {
  id: string;
  numero: string;
  estado: string;
  ventana: number;
  venceEl: string | null;
  observaciones: string;
  fechaApertura: string | null;
  ultimaObservacion: { motivo: string; fecha: string | null } | null;
}

export interface PostulanteDTO {
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefonoMovil: string;
}

export interface FaltanteDTO {
  seccion: string;
  campo: string;
  mensaje: string;
}

export interface FotoDTO {
  tiene: boolean;
  subidaEl: string | null;
  tamano: number | null;
}

export interface MiExpedienteDTO {
  expediente: ExpedienteDTO;
  postulante: PostulanteDTO;
  datosVentana1: Record<string, unknown>;
  camposPendientes: string[];
  /** Qué formulario toca: el de la Ventana 1 o el de la 2. */
  formulario: "ventana1" | "ventana2" | null;
  datosVentana2: Record<string, unknown>;
  tieneFoto: boolean;
  faltantesVentana2: FaltanteDTO[];
}

/** `GET/PUT ventana2/`: borrador de la Ventana 2, lo que falta y el estado de la foto. */
export interface Ventana2DTO {
  expediente: ExpedienteDTO;
  datos: Record<string, unknown>;
  faltantes: FaltanteDTO[];
  completa: boolean;
  foto: FotoDTO;
}

/** Sesión de invitado que devuelve `acceso/` y `cambiar-clave/`. */
export interface SesionInvitadoDTO {
  token: string;
  scope: string;
  expiraEl: string;
  expiraEnSegundos: number;
  debeCambiarClave: boolean;
  expediente: { id: string; numero: string; estado: string; ventana: number; venceEl: string | null };
}

export interface EnvioDTO {
  sesionCerrada: boolean;
  expediente: ExpedienteDTO;
}

/** Resultado de una Server Action: no lanza al cliente, devuelve el motivo. */
export type ResultadoPostulacion<T = void> =
  | { ok: true; datos: T }
  | {
      ok: false;
      mensaje: string;
      codigo?: string;
      errores?: Record<string, string[]>;
      /** `VENTANA2_INCOMPLETA`: lo que falta para enviar. */
      faltantes?: FaltanteDTO[];
      /** Ordena al cliente volver a la pantalla de acceso (sesión caída). */
      sesionCaida?: boolean;
    };

/** Enlace de activación válido (D-10): lo único que se muestra antes de pedir la cédula. */
export interface EnlaceValidoDTO {
  numero: string;
  venceEl: string;
}
