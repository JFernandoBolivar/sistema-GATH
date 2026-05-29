import z from "zod";

export const schemaUpdateRelaction = z.object({
  mismo_ente: z.boolean().optional(),
  heredero: z.boolean().optional(),
  orden_hijo: z.coerce.number().optional(),
  parentesco: z.coerce.number().optional(),
});
export type SchemaUpdateRelaction = z.infer<typeof schemaUpdateRelaction>;
