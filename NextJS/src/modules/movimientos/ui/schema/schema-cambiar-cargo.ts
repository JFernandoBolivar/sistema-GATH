import { z } from "zod";

export const schemaChangeCodeUI = z.object({
  code_old: z.number().min(1, { message: "Debe seleccionar un cargo del empleado" }),
  nuevo_cargo_id: z.number().min(1, { message: "Debe seleccionar un código disponible" }),
  motivo: z.number().min(1, { message: "El motivo es requerido" }),
});

export type SchemaChangeCodeUIType = z.infer<typeof schemaChangeCodeUI>;
