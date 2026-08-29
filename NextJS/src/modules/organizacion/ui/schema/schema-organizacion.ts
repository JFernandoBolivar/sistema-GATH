import { z } from "zod";

export const organizacionFilterSchema = z.object({
  dependenciaId: z.number().optional(),
  direccionGeneralId: z.number().optional(),
  direccionLineaId: z.number().optional(),
});

export type OrganizacionFilterType = z.infer<typeof organizacionFilterSchema>;
