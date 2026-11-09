/**
 * Descarga de los documentos del historial de movimientos desde el navegador.
 *
 * Llama al handler del mismo origen `GET /api/movimientos/{pdf|excel}` (que
 * reenvía los filtros a Django con la sesión) y devuelve el archivo junto con
 * las cabeceras `X-Reporte-*` de truncado.
 */
import { archivoDeRespuesta, type OpcionesExportacion } from "@/shared/lib/exportaciones-asincronas";
import type { ArchivoDescargado } from "../../domain/value-objects/resultado-historial";
import type { FiltrosMovimientosApi } from "./movimientos-api";

export type FormatoDescarga = "pdf" | "excel";

const RUTA_POR_FORMATO: Record<FormatoDescarga, string> = {
  pdf: "/api/movimientos/pdf",
  excel: "/api/movimientos/excel",
};

function aQueryString(filtros?: FiltrosMovimientosApi): string {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros ?? {})) {
    if (valor !== undefined && valor !== null && `${valor}`.trim() !== "") {
      params.set(clave, String(valor));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function descargarHistorial(
  formato: FormatoDescarga,
  filtros?: FiltrosMovimientosApi,
  opciones: OpcionesExportacion = {},
): Promise<ArchivoDescargado> {
  const respuesta = await fetch(`${RUTA_POR_FORMATO[formato]}${aQueryString(filtros)}`, {
    signal: opciones.signal,
  });
  // 202: exportación asíncrona (se espera el trabajo y se descarga el archivo).
  return archivoDeRespuesta(
    respuesta,
    `No fue posible generar el documento en ${formato.toUpperCase()}.`,
    opciones,
  );
}
