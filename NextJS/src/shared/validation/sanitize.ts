/** Elimina espacios al inicio/final y normaliza espacios múltiples internos. */
export function normalizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Normaliza un correo: minúsculas y sin espacios sobrantes. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Elimina caracteres de control no imprimibles. */
export function stripControlChars(value: string): string {
  return value.replace(/[\x00-\x1F\x7F]/g, "");
}

/** Elimina etiquetas HTML/XML de un texto (defensa en profundidad ante XSS almacenado). */
export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

/** Sanitización estándar para campos de texto libre: trim + normalización + sin control chars. */
export function sanitizeText(value: string): string {
  return stripControlChars(normalizeSpaces(value));
}

/** Heurística básica para detectar intentos de inyección SQL en un input de texto libre. */
export function hasSqlInjection(value: string): boolean {
  const patterns = [
    /(\bSELECT\b.*\bFROM\b)/i,
    /(\bDROP\b.*\bTABLE\b)/i,
    /(\bDELETE\b.*\bFROM\b)/i,
    /(\bINSERT\b.*\bINTO\b)/i,
    /(\bUNION\b.*\bSELECT\b)/i,
    /('.*--)/,
    /('.*#)/,
    /(\bOR\b.*\d+\s*=\s*\d+)/i,
  ];
  return patterns.some((pattern) => pattern.test(value));
}
