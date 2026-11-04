/**
 * Descarga de la bitácora (D10) desde el navegador, a través del handler del
 * mismo origen `/api/auditoria/{pdf|excel}` (conserva la sesión y expone las
 * cabeceras X-Reporte-* de truncado).
 */
import { archivoDeRespuesta, type OpcionesExportacion } from "@/shared/lib/exportaciones-asincronas";
import type { ArchivoAuditoriaDTO, FiltrosAuditoria } from "../../application/dtos/auditoria-dto";
import type { FormatoAuditoria } from "../../domain/ports/repo-auditoria";

const RUTA_POR_FORMATO: Record<FormatoAuditoria, string> = {
  pdf: "/api/auditoria/pdf",
  excel: "/api/auditoria/excel",
};

export async function descargarAuditoria(
  formato: FormatoAuditoria,
  filtros: FiltrosAuditoria,
  opciones: OpcionesExportacion = {},
): Promise<ArchivoAuditoriaDTO> {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
      params.set(clave, String(valor).trim());
    }
  }
  const query = params.toString();
  const respuesta = await fetch(`${RUTA_POR_FORMATO[formato]}${query ? `?${query}` : ""}`, {
    signal: opciones.signal,
  });
  // 202: exportación asíncrona (se espera el trabajo y se descarga el archivo).
  return archivoDeRespuesta(
    respuesta,
    `No fue posible generar la bitácora en ${formato.toUpperCase()}.`,
    opciones,
  );
}
