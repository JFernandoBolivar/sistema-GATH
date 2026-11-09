export interface NotificacionDTO {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  /** Ruta interna ya validada, o `null` si la notificación no tiene destino utilizable. */
  enlace: string | null;
  leida: boolean;
  fechaLectura: string | null;
  creadaEn: string;
}

export interface PaginaNotificacionesDTO {
  total: number;
  limite: number;
  desplazamiento: number;
  resultados: NotificacionDTO[];
}

/** Resultado uniforme de las Server Actions del módulo. */
export type ResultadoNotificacion<T = undefined> =
  { ok: true; mensaje: string; datos: T } | { ok: false; mensaje: string };
