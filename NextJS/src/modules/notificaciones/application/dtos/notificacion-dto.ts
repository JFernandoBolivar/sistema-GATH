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
  atendida?: boolean;
  atendidaPorNombre?: string;
  fechaAtendida?: string | null;
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

/** Estado de la bandeja para el sondeo; `huella` cambia si llega, se lee o se atiende un aviso. */
export interface EstadoBandejaDTO {
  noLeidas: number;
  ultimaActualizacion: string | null;
  huella: string;
}
