import z from "zod";

export const schemaCategory = z.object({
  nombre_categoria: z
    .string({ required_error: "Campo Obligatorio" })
    .trim()
    .min(2, { message: "Mínimo 2 Caracteres" })
    .max(100, { message: "Máximo 100 Caracteres" }),
});

export type CategoryGroup = z.infer<typeof schemaCategory>;
