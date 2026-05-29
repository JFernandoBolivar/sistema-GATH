import { z } from "zod";

export const schemaRegionTalla = z.object({
  codigo: z.string({ required_error: "Campo Obligatorio" }),
});

export type RegionTallaSchema = z.infer<typeof schemaRegionTalla>;
