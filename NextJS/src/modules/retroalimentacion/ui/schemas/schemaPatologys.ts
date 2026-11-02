import z from "zod";

export const schemaPatologys = z.object({
  patologia: z
    .string({
      required_error: "Campo Requerido",
    })
    .min(3, {
      message: "Mínimo 3 Caracteres",
    })
    .max(100, {
      message: "Máximo 100 Caracteres",
    }),
  categoria_id: z.coerce.number().min(1, {
    message: "Debe Seleccionar al menos una categoría",
  }),
});

export type PatologySchema = z.infer<typeof schemaPatologys>;
