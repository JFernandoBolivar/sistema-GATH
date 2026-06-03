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
  codigo_postal_id: z.coerce.number().optional(),
});

export function buildSchema(preguntas: Pregunta[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const pregunta of preguntas) {
    const tipo = pregunta.tipo.nombre;

    if (tipo === "abierta" || tipo === "string") {
      shape[String(pregunta.id)] = z
        .string()
        .min(1, "Este campo es obligatorio");
    } else if (tipo === "number" || tipo === "float") {
      let field: z.ZodTypeAny = z.coerce.number({
        invalid_type_error: "Debe ingresar un número",
      });

      if (tipo === "float") {
        field = field.refine(
          (val) => {
            const decimals = String(val).split(".")[1];
            return !decimals || decimals.length <= 2;
          },
          "Máximo 2 decimales permitidos",
        );
      }

      if (pregunta.validacion) {
        const digitos = parseInt(pregunta.validacion, 10);
        if (!isNaN(digitos)) {
          field = field.refine(
            (val) => String(Math.abs(val)).length >= digitos,
            `Debe tener al menos ${digitos} dígitos`,
          );
        }
      }

      shape[String(pregunta.id)] = field;
    } else if (tipo === "cerrada") {
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
