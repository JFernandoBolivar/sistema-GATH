import { z } from "zod";

export const reporteFilterSchema = z.object({
  dependenciaId: z.number().positive().optional(),
  tipoPersonalId: z.number().positive().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
});

export type ReporteFilterType = z.infer<typeof reporteFilterSchema>;
