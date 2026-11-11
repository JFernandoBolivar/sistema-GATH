/**
 * Detecta el error típico de una pestaña abierta durante un despliegue: el navegador
 * conserva el JavaScript del build anterior y pide acciones de servidor o fragmentos
 * que el build nuevo ya no tiene. Se corrige recargando la página una vez.
 */
const PATRONES = [
  /failed to find server action/i,
  /server action .* was not found/i,
  /chunkloaderror/i,
  /loading chunk .* failed/i,
  /failed to fetch dynamically imported module/i,
  /an unexpected response was received from the server/i,
];

const CLAVE = "gath:recarga-version";
const VENTANA_MS = 60_000;

export function esVersionDesfasada(error: { name?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const texto = `${error.name ?? ""} ${error.message ?? ""}`;
  return PATRONES.some((p) => p.test(texto));
}

/** Recarga una sola vez por minuto, para no entrar en un bucle si el error persiste. */
export function recargarSiVersionDesfasada(
  error: { name?: string; message?: string } | null | undefined,
  ahora: number = Date.now(),
  almacen: Pick<Storage, "getItem" | "setItem"> | null = typeof window !== "undefined" ? window.sessionStorage : null,
  recargar: () => void = () => window.location.reload(),
): boolean {
  if (!esVersionDesfasada(error)) return false;
  try {
    const ultima = Number(almacen?.getItem(CLAVE) ?? 0);
    if (ahora - ultima < VENTANA_MS) return false;
    almacen?.setItem(CLAVE, String(ahora));
  } catch {
    // Sin sessionStorage: se recarga igual, una vez por montaje del error.
  }
  recargar();
  return true;
}
