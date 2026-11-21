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

export interface MiExpedienteDTO {
  expediente: ExpedienteDTO;
  postulante: PostulanteDTO;
  datosVentana1: Record<string, unknown>;
  camposPendientes: string[];
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
      /** Ordena al cliente volver a la pantalla de acceso (sesión caída). */
      sesionCaida?: boolean;
    };
