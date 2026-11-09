/** Motivo único de la solicitud (decisión G): mínimo 5 palabras y 20 caracteres. Espejo del servidor. */
export const MOTIVO_MIN_PALABRAS = 5;
export const MOTIVO_MIN_CARACTERES = 20;
export const MOTIVO_MAX_CARACTERES = 500;

export const MOTIVO_MIN_MSG = `El motivo debe tener al menos ${MOTIVO_MIN_PALABRAS} palabras y ${MOTIVO_MIN_CARACTERES} caracteres`;

/** Devuelve el mensaje de error, o `null` si el motivo es válido. */
export function errorDeMotivo(motivo: string): string | null {
  const limpio = motivo.trim().replace(/\s+/g, " ");
  if (!limpio) return "El motivo es obligatorio";
  const palabras = limpio.split(" ").length;
  if (limpio.length < MOTIVO_MIN_CARACTERES || palabras < MOTIVO_MIN_PALABRAS) {
    return MOTIVO_MIN_MSG;
  }
  if (limpio.length > MOTIVO_MAX_CARACTERES) {
    return `El motivo no puede superar ${MOTIVO_MAX_CARACTERES} caracteres`;
  }
  return null;
}
