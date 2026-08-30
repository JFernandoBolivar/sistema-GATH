import { z } from "zod";

export const reporteFilterSchema = z.object({
  dependenciaId: z.number().positive().optional(),
  tipoPersonalId: z.number().positive().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
});

/** Tipo de reporte para descargas PDF/Excel (zero-trust R7). */
export const tipoReporteSchema = z.enum(["personal-activo", "personal-pasivo", "vacantes"]);

export type ReporteFilterType = z.infer<typeof reporteFilterSchema>;
export type TipoReporteFormType = z.infer<typeof tipoReporteSchema>;
