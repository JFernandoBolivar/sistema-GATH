"use client";

/**
 * Reporte de familiares de trabajadores PASIVOS: mismos filtros, tabla/PDF y
 * descarga que el de personal activo (`ReportFamily`); solo cambia la categoría
 * enviada al proxy de reportes, que pide al backend `condicion=PASIVO`.
 */
import ReportFamily from "./report-family";

export default function ReportFamilyPasivos() {
  return <ReportFamily categoria="familiares-pasivos" />;
}
