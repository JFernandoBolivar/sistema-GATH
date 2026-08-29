import { z } from "zod";

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

export type ItemRespuestaCensoFormType = z.infer<typeof itemRespuestaCensoSchema>;
export type RegistrarCensoFormType = z.infer<typeof registrarCensoSchema>;
