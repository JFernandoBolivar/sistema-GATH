/** Restablecimiento de contraseñas en bloque (U2): tipos del dominio. */
export type ClasificacionBloque = "ACTIVOS" | "PASIVOS" | "AMBOS";
export type AlcanceBloque = "SIN_PRIMER_INGRESO" | "TODOS";

export interface SolicitudBloque {
  clasificacion: ClasificacionBloque;
  alcance: AlcanceBloque;
  enviarCorreo: boolean;
  motivo: string;
}

export interface VistaPreviaBloque {
  revisadas: number;
  activos: number;
  pasivos: number;
  total: number;
  omitidasAdministrativas: number;
}

export type EstadoTareaBloque = "EN_PROCESO" | "LISTO" | "ERROR" | "CANCELADO";

export interface ResultadoBloque {
  revisadas: number;
  restablecidas: number;
  omitidas: number;
  activos: number;
  pasivos: number;
  total: number;
  errores: number;
}

export interface EstadoBloque {
  taskId: string;
  estado: EstadoTareaBloque;
  resultado: ResultadoBloque | null;
  mensaje: string | null;
}
