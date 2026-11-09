import z from "zod";

export const schemaDisability = z.object({
  discapacidad: z
    .string({ required_error: "Campo Obligatorio" })
    .trim()
    .min(2, { message: "Mínimo 2 Caracteres" })
    .max(100, { message: "Máximo 100 Caracteres" }),
  categoria_id: z.coerce.number().min(1, {
    message: "Debe Seleccionar Una Categoría",
  }),
});

export type DisabitySchema = z.infer<typeof schemaDisability>;
