/** Restablecimiento de contraseñas en bloque (U2): tipos del dominio. */
export type ClasificacionBloque = "ACTIVOS" | "PASIVOS" | "AMBOS";
export type AlcanceBloque = "VENCIDA" | "SIN_PRIMER_INGRESO" | "TODOS";
export type CondicionBloque = "ACTIVO" | "PASIVO" | "SIN_ASIGNACION";

export interface SolicitudBloque {
  clasificacion: ClasificacionBloque;
  alcance: AlcanceBloque;
  enviarCorreo: boolean;
  motivo: string;
}

export interface MuestraBloque {
  cuentaId: number;
  cedula: string;
  nombre: string;
  condicion: CondicionBloque | string;
  venceEn: string | null;
}

export interface VistaPreviaBloque {
  revisadas: number;
  activos: number;
  pasivos: number;
  total: number;
  omitidasAdministrativas: number;
  muestra: MuestraBloque[];
  /** Fecha (aaaa-mm-dd) hasta la que se renovará el plazo. */
  venceEnNuevo: string | null;
}

export type EstadoTareaBloque = "EN_PROCESO" | "LISTO" | "ERROR" | "CANCELADO";

export interface ResultadoBloque {
  revisadas: number;
  restablecidas: number;
  omitidas: number;
  errores: number;
  venceEnNuevo: string | null;
}

export interface EstadoBloque {
  taskId: string;
  estado: EstadoTareaBloque;
  resultado: ResultadoBloque | null;
  mensaje: string | null;
}

export interface ArchivoBloque {
  base64: string;
  nombre: string;
}
