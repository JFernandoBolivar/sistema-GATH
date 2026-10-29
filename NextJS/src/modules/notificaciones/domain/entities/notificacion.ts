/** Notificación propia del usuario (la bandeja de la campana). */
export interface NotificacionEntity {
  readonly id: string;
  /** Código del hecho, p. ej. `autogestion.ventana_habilitada`. */
  readonly tipo: string;
  readonly titulo: string;
  readonly mensaje: string;
  /** Ruta interna relativa del frontend; cadena vacía si no hay destino. */
  readonly enlace: string;
  readonly refTipo: string;
  readonly refId: string;
  readonly leida: boolean;
  readonly fechaLectura: string | null;
  readonly creadaEn: string;
}

export interface PaginaNotificacionesEntity {
  readonly total: number;
  readonly limite: number;
  readonly desplazamiento: number;
  readonly resultados: NotificacionEntity[];
}

/**
 * Devuelve el enlace solo si es una ruta interna relativa (`/algo`). Rechaza URLs absolutas,
 * protocolos (`javascript:`) y `//host`, para que una notificación nunca saque al usuario del sitio.
 */
export function enlaceInterno(enlace: string | null | undefined): string | null {
  const valor = (enlace ?? "").trim();
  if (!valor.startsWith("/") || valor.startsWith("//") || valor.includes("\\")) return null;
  return valor;
}
