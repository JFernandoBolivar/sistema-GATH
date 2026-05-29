import z from "zod";

export const schemaRegister = z.object({
  cedula: z
    .string({
      required_error: "Este Campo Es Obligatorio",
    })
    .min(5, {
      message: "Minimo 5 Caracteres",
    })
    .max(8, {
      message: "Maximo 8 Caracteres",
    }),
  password: z
    .string({
      required_error: "Este Campo Es Obligatorio",
    })
    .min(8, {
      message: "Minimo 8 Caracteres",
    })
    .max(16, {
      message: "Maximo 16 Caracteres",
    }),
  departamento: z.coerce.number().min(1, {
    message: "Debe Seleccionar Un Departamento",
  }),
  rol: z.coerce.number().min(1, {
    message: "Debe Seleccionar Un Rol",
  }),
});

export type TypeSchemaRegister = z.infer<typeof schemaRegister>;
