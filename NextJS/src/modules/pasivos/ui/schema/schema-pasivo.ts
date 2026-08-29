import { z } from "zod";
import { ERROR, REGEX } from "@/shared/domain/validation";

/** Listado de pasivos por búsqueda (zero-trust R7). */
export const listadoPasivosSchema = z.object({
  busqueda: z.string().trim().max(100, { message: "Búsqueda demasiado larga" }).optional(),
});

/** Cédula de trabajador pasivo (zero-trust R7). */
export const pasivoCedulaSchema = z.object({
  cedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula inválida" }),
});

/** Transición activo → pasivo (zero-trust R7). */
export const procesarEgresoSchema = z.object({
  cedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula inválida" }),
  motivoMovimientoId: z.number().int().positive({ message: ERROR.REQUIRED }),
  tipoNominaId: z.number().int().positive({ message: ERROR.REQUIRED }),
  liberarActivos: z.boolean().default(true),
});

export type ListadoPasivosFormType = z.infer<typeof listadoPasivosSchema>;
export type PasivoCedulaFormType = z.infer<typeof pasivoCedulaSchema>;
export type ProcesarEgresoFormType = z.infer<typeof procesarEgresoSchema>;
