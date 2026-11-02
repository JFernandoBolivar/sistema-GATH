/**
 * Cabeceras con que el backend informa el tamaño de un documento descargable
 * (PDF/Excel) y si se truncó al alcanzar `REPORTES_MAX_FILAS*`.
 *
 * Un único lugar para los nombres: los proxies y los servicios de descarga de
 * cada módulo (reportes, movimientos) no repiten literales.
 */
export const CABECERA_TOTAL_REGISTROS = "X-Reporte-Total-Registros";
export const CABECERA_LIMITE = "X-Reporte-Limite";
export const CABECERA_TRUNCADO = "X-Reporte-Truncado";

export interface MetadatosDeTruncado {
  total: number | null;
  limite: number | null;
  truncado: boolean;
}

function numero(valor: string | null): number | null {
  if (valor === null || valor.trim() === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export function metadatosDeTruncado(headers: Headers): MetadatosDeTruncado {
  return {
    total: numero(headers.get(CABECERA_TOTAL_REGISTROS)),
    limite: numero(headers.get(CABECERA_LIMITE)),
    truncado: headers.get(CABECERA_TRUNCADO) === "true",
  };
}
