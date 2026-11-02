/**
 * Descarga de la bitácora (D10) desde el navegador, a través del handler del
 * mismo origen `/api/auditoria/{pdf|excel}` (conserva la sesión y expone las
 * cabeceras X-Reporte-* de truncado).
 */
import { metadatosDeTruncado } from "@/shared/lib/encabezados-reporte";
import type { ArchivoAuditoriaDTO, FiltrosAuditoria } from "../../application/dtos/auditoria-dto";
import type { FormatoAuditoria } from "../../domain/ports/repo-auditoria";

const RUTA_POR_FORMATO: Record<FormatoAuditoria, string> = {
  pdf: "/api/auditoria/pdf",
  excel: "/api/auditoria/excel",
};

export async function descargarAuditoria(
  formato: FormatoAuditoria,
  filtros: FiltrosAuditoria,
): Promise<ArchivoAuditoriaDTO> {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
      params.set(clave, String(valor).trim());
    }
  }
  const query = params.toString();
  const respuesta = await fetch(`${RUTA_POR_FORMATO[formato]}${query ? `?${query}` : ""}`);

  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => null)) as { error?: string } | null;
    throw new Error(
      cuerpo?.error?.trim() || `No fue posible generar la bitácora en ${formato.toUpperCase()}.`,
    );
  }

  return {
    blob: await respuesta.blob(),
    ...metadatosDeTruncado(respuesta.headers),
  };
}
