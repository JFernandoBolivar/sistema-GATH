/**
 * RIF venezolano (Registro de Información Fiscal del SENIAT). Espejo de `domain/value_objects/rif.py` del backend.
 * Formato canónico `L-NNNNNNNN-D`: letra V/E/J/P/G, ocho dígitos y un dígito verificador. Se aceptan minúsculas, con o
 * sin guiones o espacios, y un cuerpo de 7 u 8 dígitos (el de 7 se completa con un cero a la izquierda).
 * No se recalcula el dígito verificador: el algoritmo del SENIAT tiene variantes y rechazar un RIF real es peor que
 * aceptar uno mal tecleado.
 */
export const LETRAS_RIF = "VEJPG";
const PATRON_RIF = new RegExp(`^([${LETRAS_RIF}])(\\d{7,8})(\\d)$`);

export const MENSAJE_RIF_INVALIDO = "Escriba un RIF válido, por ejemplo V-12345678-9";

/** `v-1234567-8` -> `V-01234567-8`; `""` si está vacío; `null` si no tiene el formato del RIF venezolano. */
export function normalizarRif(valor: string): string | null {
  const compacto = valor.replace(/[\s-]/g, "").toUpperCase();
  if (!compacto) return "";
  const m = PATRON_RIF.exec(compacto);
  return m ? `${m[1]}-${m[2].padStart(8, "0")}-${m[3]}` : null;
}
