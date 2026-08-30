import { z } from "zod";
import { REGEX } from "@/shared/domain/validation";

/**
 * Una respuesta del censo dinámico (Fase 1 del plan de reparación: el censo
 * es un cuestionario de preguntas/opciones administradas por RRHH, no un
 * formulario fijo de campos de vivienda/vehículo/tallas).
 */
export const itemRespuestaCensoSchema = z.object({
  preguntaId: z.number().positive({ message: "Pregunta inválida" }),
  opcionId: z.number().positive().optional().nullable(),
  respuesta: z.string().trim().optional(),
});

export const registrarCensoSchema = z.object({
  respuestas: z.array(itemRespuestaCensoSchema).min(1, { message: "Debe responder al menos una pregunta" }),
});

/** Cédula para consultar el censo de un empleado (zero-trust R7). */
export const censoCedulaSchema = z.object({
  cedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula inválida" }),
});

export type ItemRespuestaCensoFormType = z.infer<typeof itemRespuestaCensoSchema>;
export type RegistrarCensoFormType = z.infer<typeof registrarCensoSchema>;
export type CensoCedulaFormType = z.infer<typeof censoCedulaSchema>;
