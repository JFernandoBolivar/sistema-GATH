import type { FiltrosBandejaValores } from "../schema/schema-fe-de-vida";

/** Parámetros de la exportación asíncrona de la bandeja (mismos filtros que la pantalla). */
export function parametrosExportarBandeja(
  filtros: FiltrosBandejaValores,
  historico: boolean,
  formato: "pdf" | "excel",
): Record<string, string | boolean> {
  return {
    texto: filtros.texto.trim(),
    estado: filtros.estado,
    proceso_id: filtros.procesoId,
    desde: filtros.desde,
    hasta: filtros.hasta,
    historico,
    formato,
  };
}

export function consultaExportarBandeja(parametros: Record<string, string | boolean>): string {
  const query = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== "" && valor !== false) query.set(clave, String(valor));
  }
  return query.toString();
}
