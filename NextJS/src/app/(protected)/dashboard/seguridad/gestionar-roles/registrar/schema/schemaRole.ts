import z from "zod";

export const schemaRole = z.object({
  nombre_rol: z
    .string({
      required_error: "Este Campo Es Obligatorio",
    })
    .min(3, {
      message: "Minimo 3 Caracteres",
    })
    .max(50, {
      message: "Maximo 50 Caracteres",
    }),
});

export type TypeSchemaRole = z.infer<typeof schemaRole>;
