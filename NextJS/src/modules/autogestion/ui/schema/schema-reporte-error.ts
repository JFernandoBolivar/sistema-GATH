import { z } from "zod";

/** Mismas cifras que el backend (apps/personal/domain/entities/reporte_error.py). */
export const DESCRIPCION_MIN = 10;
export const DESCRIPCION_MAX = 500;

export const DATOS_REPORTABLES = ["cargo", "oficina", "fecha_ingreso", "otro"] as const;

export const reporteErrorLaboralSchema = z.object({
  dato: z.enum(DATOS_REPORTABLES),
  descripcion: z
    .string()
    .trim()
    .min(DESCRIPCION_MIN, `La descripción debe tener al menos ${DESCRIPCION_MIN} caracteres.`)
    .max(DESCRIPCION_MAX, `La descripción no puede exceder ${DESCRIPCION_MAX} caracteres.`),
});
export type ReporteErrorLaboralValores = z.infer<typeof reporteErrorLaboralSchema>;
