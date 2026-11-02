import { z } from "zod";

export const schemaCensoExcel = z.object({
  filtros: z
    .object({
      dependencia_id: z.number().optional(),
      direccion_general_id: z.number().optional(),
      direccion_linea_id: z.number().nullable().optional(),
      coordinacion_id: z.number().nullable().optional(),
      nomina_id: z.number().optional(),
    })
    .optional(),
});

export type SchemaCensoExcelType = z.infer<typeof schemaCensoExcel>;
