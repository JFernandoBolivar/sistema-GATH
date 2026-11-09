type QueryValue = string | number | boolean | undefined | null;

/**
 * Construye un query string a partir de un objeto, omitiendo `undefined`, `null` y `""`.
 * Devuelve cadena vacía si no queda ningún parámetro (nunca un "?" suelto).
 */
export function queryParams(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }

  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}
