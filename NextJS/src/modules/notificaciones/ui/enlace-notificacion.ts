/**
 * FIX-QA18: normaliza el enlace de una notificación a una ruta interna.
 *
 * Devuelve `null` para enlaces vacíos, externos, protocol-relative o con
 * esquemas peligrosos (`javascript:`, `data:`…). En esos casos la UI debe
 * avisar en vez de no hacer nada.
 */
export function destinoInterno(enlace: string | null | undefined): string | null {
  const valor = (enlace ?? "").trim();
  if (!valor.startsWith("/") || valor.startsWith("//")) return null;
  try {
    const url = new URL(valor, "https://gath.invalid");
    if (url.origin !== "https://gath.invalid") return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Ruta actual del navegador con búsqueda y ancla, para comparar con `destinoInterno`. */
export function rutaActual(location: { pathname: string; search: string; hash: string }): string {
  return `${location.pathname}${location.search}${location.hash}`;
}
