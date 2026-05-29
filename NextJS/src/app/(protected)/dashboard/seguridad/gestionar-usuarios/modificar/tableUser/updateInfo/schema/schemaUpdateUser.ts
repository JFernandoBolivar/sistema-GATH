import z from "zod";

export const schemaUpdateUser = z.object({
  departamento: z.coerce.number().default(0),
  rol: z.coerce.number().default(0),
  password: z.string().optional(),
});
export type TypeSchemaUpdateUser = z.infer<typeof schemaUpdateUser>;
