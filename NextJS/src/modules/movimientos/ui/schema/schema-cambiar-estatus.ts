import { z } from "zod";

export const schemaStatusChangeUI = z.object({
  cargo: z.number().min(1, { message: "Debe seleccionar un cargo del empleado" }),
  estatus_id: z.number().min(1, { message: "Debe seleccionar un estatus" }),
  motivo: z.number().min(1, { message: "El motivo es requerido" }),
});

export type SchemaStatusChangeUIType = z.infer<typeof schemaStatusChangeUI>;
