import z from "zod";

export const schemaAsignCode = z.object({
  code: z.number(),
  employee: z.string(),
});
