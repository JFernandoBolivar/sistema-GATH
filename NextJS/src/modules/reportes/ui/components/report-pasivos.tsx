"use client";

/**
 * Reporte de pasivos con la misma interfaz de filtros y generación de PDF que
 * el reporte de personal activo (`ReportEmployee`). Solo cambia la categoría
 * que se envía al proxy de reportes.
 */
import ReportEmployee from "./report-employees";

export default function ReportPasivos() {
  return <ReportEmployee categoria="pasivos" />;
}
