import { z } from "zod";

export const reporteFilterSchema = z.object({
  dependenciaId: z.number().positive().optional(),
  tipoPersonalId: z.number().positive().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
});

/** Filtros del reporte de familiares (parentesco/sexo del familiar). */
export const reporteFamiliaresFilterSchema = z.object({
  parentescoId: z.number().positive().optional(),
  sexoId: z.number().positive().optional(),
});

/** Filtros del reporte de códigos de cargo (asignaciones). */
export const reporteCodigosFilterSchema = z.object({
  dependenciaId: z.number().positive().optional(),
  nominaId: z.number().positive().optional(),
});

/** Tipo de reporte para descargas PDF/Excel (zero-trust R7). */
export const tipoReporteSchema = z.enum([
  "personal-activo",
  "personal-pasivo",
  "vacantes",
  "familiares",
  "codigos",
  "tendencias",
]);

export type ReporteFilterType = z.infer<typeof reporteFilterSchema>;
export type ReporteFamiliaresFilterType = z.infer<typeof reporteFamiliaresFilterSchema>;
export type ReporteCodigosFilterType = z.infer<typeof reporteCodigosFilterSchema>;
export type TipoReporteFormType = z.infer<typeof tipoReporteSchema>;
