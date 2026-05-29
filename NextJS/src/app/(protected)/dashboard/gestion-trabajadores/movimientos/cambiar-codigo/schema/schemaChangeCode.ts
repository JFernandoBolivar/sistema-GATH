import z from "zod";

export const schemaChangeCode = z.object({
  nuevo_cargo_id: z.number(),
  code_old: z.number(),
  motivo: z.number(),
});
