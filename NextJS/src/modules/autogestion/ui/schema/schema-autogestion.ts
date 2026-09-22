import z from "zod";
import type { Pregunta } from "@/app/types/types";

export const viviendaSchema = z.object({
  direccion_exacta: z
    .string()
    .min(3, "La dirección debe tener al menos 3 caracteres"),
  estado_id: z.coerce.number().min(1, "Seleccione un estado"),
  municipio_id: z.coerce.number().min(1, "Seleccione un municipio"),
  parroquia: z.coerce.number().min(1, "Seleccione una parroquia"),
  condicion_vivienda_id: z.coerce
    .number()
    .min(1, "Seleccione una condición de vivienda"),
  codigo_postal_id: z.coerce.number().optional(),
});

export function buildSchema(preguntas: Pregunta[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const pregunta of preguntas) {
    const tipo = typeof pregunta.tipo === "string" ? pregunta.tipo : pregunta.tipo?.nombre;

    if (tipo === "abierta" || tipo === "string") {
      shape[String(pregunta.id)] = z
        .string()
        .min(1, "Este campo es obligatorio");
    } else if (pregunta.id === 1) {
      // Código del Carnet de la Patria: se valida como string para conservar ceros a la izquierda
      let carnetField: z.ZodTypeAny = z
        .string()
        .min(1, "Este campo es obligatorio")
        .regex(/^\d+$/, "Debe ingresar solo números");

      if (pregunta.validacion) {
        const digitos = parseInt(pregunta.validacion, 10);
        if (!isNaN(digitos)) {
          carnetField = carnetField.refine(
            (val) => val.length === digitos,
            `Debe tener ${digitos} dígitos`,
          );
        }
      }

      shape[String(pregunta.id)] = carnetField;
    } else if (tipo === "number" || tipo === "float") {
      let stringField: z.ZodTypeAny = z
        .string()
        .min(1, "Este campo es obligatorio")
        .regex(/^\d+(\.\d+)?$/, "Debe ingresar un número");

      if (pregunta.validacion) {
        const digitos = parseInt(pregunta.validacion, 10);
        if (!isNaN(digitos)) {
          const minDigitos = digitos;
          const maxDigitos = digitos === 1 ? 2 : digitos;

          stringField = stringField.refine(
            (val) => {
              const len = val.replace(".", "").length;
              return len >= minDigitos && len <= maxDigitos;
            },
            minDigitos === maxDigitos
              ? `Debe tener máximo ${digitos} dígitos`
              : `Debe tener entre ${minDigitos} y ${maxDigitos} dígitos`,
          );
        }
      }

      let field: z.ZodTypeAny = stringField.transform((val) => Number(val));
      field = field.refine((val) => val >= 0, "Solo se permiten valores positivos");

      if (tipo === "float") {
        field = field.refine(
          (val) => {
            const decimals = String(val).split(".")[1];
            return !decimals || decimals.length <= 2;
          },
          "Máximo 2 decimales permitidos",
        );
      }

      shape[String(pregunta.id)] = field;
    } else if (tipo === "cerrada") {
      if (pregunta.opciones && pregunta.opciones.length === 1) {
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
