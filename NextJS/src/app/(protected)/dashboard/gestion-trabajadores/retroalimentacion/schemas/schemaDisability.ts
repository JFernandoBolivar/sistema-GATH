import z from "zod";

export const schemaDisability = z.object({
  discapacidad: z.string({
    required_error: "Campo Obligatorio",
  }),
  categoria_id: z.coerce.number().min(1, {
    message: "Debe Seleccionar Una Categoria",
  }),
});
export type DisabitySchema = z.infer<typeof schemaDisability>;
