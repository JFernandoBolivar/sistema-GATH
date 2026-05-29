import z from "zod";

export const schemaPatologys = z.object({
  patologia: z
    .string({
      required_error: "Campo Requerido",
    })
    .min(3, {
      message: "Minimo 3 Caracteres",
    })
    .max(16, {
      message: "Maximo 16 Caracteres",
    }),
  categoria_id: z.coerce.number().min(1, {
    message: "Debe Seleccionar al menos una categoria",
  }),
});
export type PatologySchema = z.infer<typeof schemaPatologys>;
