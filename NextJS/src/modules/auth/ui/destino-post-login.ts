/**
 * Destino tras el login (F2-03). Solo se acepta una ruta interna: empieza por
 * "/", no por "//" ni "/\\" y resuelve al mismo origen. Cualquier otra cosa
 * (otro origen, esquema ajeno, vacio) cae en /dashboard.
 */
const DESTINO_POR_DEFECTO = "/dashboard";

export function destinoPostLogin(callback: string | null, origin: string): string {
  if (!callback || !callback.startsWith("/") || callback.startsWith("//") || callback.startsWith("/\\")) {
    return DESTINO_POR_DEFECTO;
  }
  try {
    const url = new URL(callback, origin);
    if (url.origin !== origin) return DESTINO_POR_DEFECTO;
    return url.pathname + url.search + url.hash;
  } catch {
    return DESTINO_POR_DEFECTO;
  }
}
