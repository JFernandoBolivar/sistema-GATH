/**
 * Reglas de la clave nueva del postulante. Espejo de `validar_clave_nueva` del backend:
 * 10 o más caracteres, letras y números, sin la cédula y distinta de la actual.
 * El backend es la autoridad; esto solo da la guía en vivo.
 */

export const LONGITUD_MINIMA_CLAVE = 10;
export const LONGITUD_MAXIMA_CLAVE = 128;

export interface ReglaClave {
  id: "longitud" | "letra" | "numero" | "sin_cedula" | "distinta";
  texto: string;
  cumple: boolean;
}

export interface EvaluacionClave {
  reglas: ReglaClave[];
  valida: boolean;
}

export function evaluarClaveNueva(
  nueva: string,
  contexto: { cedula: string; claveActual: string },
): EvaluacionClave {
  const cedula = contexto.cedula.trim();
  const vacia = nueva.length === 0;
  const reglas: ReglaClave[] = [
    {
      id: "longitud",
      texto: `Al menos ${LONGITUD_MINIMA_CLAVE} caracteres`,
      cumple: nueva.length >= LONGITUD_MINIMA_CLAVE,
    },
    { id: "letra", texto: "Incluye letras", cumple: /\p{L}/u.test(nueva) },
    { id: "numero", texto: "Incluye números", cumple: /\d/.test(nueva) },
    {
      id: "sin_cedula",
      texto: "No contiene tu cédula",
      cumple: !vacia && (cedula === "" || !nueva.includes(cedula)),
    },
    {
      id: "distinta",
      texto: "Es distinta de la contraseña temporal",
      cumple: !vacia && nueva !== contexto.claveActual,
    },
  ];
  return { reglas, valida: reglas.every((r) => r.cumple) };
}

export function clavesCoinciden(nueva: string, confirmacion: string): boolean {
  return confirmacion.length > 0 && nueva === confirmacion;
}
