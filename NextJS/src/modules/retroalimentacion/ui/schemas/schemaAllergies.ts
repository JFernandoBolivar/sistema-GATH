import z from "zod";

export const schemaAllergies = z.object({
  alergia: z.string({
    required_error: "Campo Obligatorio",
  }).min(1, { message: "Campo Obligatorio" }),
  categoria_id: z.coerce.number().min(1, {
    message: "Debe Seleccionar Una Categoría",
  }),
});

export type AllergiesSchema = z.infer<typeof schemaAllergies>;
