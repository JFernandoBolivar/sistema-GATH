/**
 * Aviso de tope de filas de un reporte descargable (G3).
 *
 * El backend corta el documento en `REPORTES_MAX_FILAS` y lo informa en las
 * cabeceras `X-Reporte-*`; la UI no debe presentar el PDF como completo cuando
 * se alcanzó el tope, ni dejar al usuario sin saber por qué faltan registros.
 */
export interface DatosDelTope {
  truncado: boolean;
  total: number | null;
  limite: number | null;
}

const numero = new Intl.NumberFormat("es-VE");

export function avisoTopeDeFilas({ truncado, total, limite }: DatosDelTope): string | null {
  if (!truncado) return null;

  const tope = limite !== null ? numero.format(limite) : null;
  const encontrados = total !== null ? numero.format(total) : null;

  if (tope && encontrados) {
    return `El reporte llegó al tope de ${tope} filas: el archivo incluye ${tope} de ${encontrados} registros. Aplique más filtros para ver el resto.`;
  }
  if (tope) {
    return `El reporte llegó al tope de ${tope} filas y puede faltar información. Aplique más filtros para ver el resto.`;
  }
  return "El reporte llegó al tope de filas y puede faltar información. Aplique más filtros para ver el resto.";
}
