/** Longitud del código hexadecimal (SHA-256) que lleva el QR de la constancia. */
export const LONGITUD_CODIGO_VERIFICACION = 64;

const PATRON_CODIGO = new RegExp(`^[0-9a-f]{${LONGITUD_CODIGO_VERIFICACION}}$`);

/** Un código con otro formato no se consulta: es inválido sin gastar una petición. */
export function codigoVerificacionValido(codigo: string): boolean {
  return PATRON_CODIGO.test(codigo);
}
