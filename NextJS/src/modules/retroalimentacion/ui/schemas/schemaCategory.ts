import z from "zod";

export const schemaCategory = z.object({
  nombre_categoria: z.string({
    required_error: "Campo Obligatorio",
  }).min(1, { message: "Campo Obligatorio" }),
});

export type CategoryGroup = z.infer<typeof schemaCategory>;
