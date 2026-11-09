const FECHA_HORA = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Caracas",
});

/** `29/10/2026, 03:45 p. m.` (hora de Venezuela). Fecha inválida: se devuelve el texto original. */
export function formatearFechaNotificacion(iso: string | null | undefined): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? iso : FECHA_HORA.format(fecha);
}

/** Texto accesible del contador: «3 notificaciones sin leer». */
export function textoConteo(noLeidas: number): string {
  if (noLeidas === 0) return "Sin notificaciones nuevas";
  return noLeidas === 1 ? "1 notificación sin leer" : `${noLeidas} notificaciones sin leer`;
}
