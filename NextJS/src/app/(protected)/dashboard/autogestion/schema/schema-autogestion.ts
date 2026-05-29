import z from "zod";
import type { Pregunta } from "@/app/types/types";

const viviendaSchema = z.object({
  direccion_exacta: z
    .string()
    .min(3, "La dirección debe tener al menos 3 caracteres"),
  estado_id: z.number().min(1, "Seleccione un estado"),
  municipio_id: z.number().min(1, "Seleccione un municipio"),
  parroquia: z.number().min(1, "Seleccione una parroquia"),
  condicion_vivienda_id: z
    .number()
    .min(1, "Seleccione una condición de vivienda"),
  codigo_postal: z.string().max(10).optional(),
});

export function buildSchema(preguntas: Pregunta[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const pregunta of preguntas) {
    if (pregunta.tipo.nombre === "abierta") {
      shape[String(pregunta.id)] = z
        .string()
        .min(1, "Este campo es obligatorio");
    } else if (pregunta.tipo.nombre === "cerrada") {
      if (pregunta.opciones.length === 1) {
        shape[String(pregunta.id)] = z
          .boolean()
          .refine((val) => val === true, "Debe aceptar");
      } else {
        shape[String(pregunta.id)] = z
          .string()
          .min(1, "Seleccione una opción");
      }
    }
  }

  shape["datos_vivienda"] = viviendaSchema;

  return z.object(shape);
}

export type AutogestionFormValues = z.infer<ReturnType<typeof buildSchema>>;
