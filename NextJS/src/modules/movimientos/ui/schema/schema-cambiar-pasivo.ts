import { z } from "zod";

export const schemaPasivoUI = z.object({
  estatus_id: z.number().min(1, { message: "Debe seleccionar un estatus" }),
  motivo: z.number().min(1, { message: "El motivo es requerido" }),
  tiponominaid: z.number().optional().default(0),
  liberar_activos: z.boolean().default(false),
  fecha_egreso: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Fecha de egreso inválida" })
    .optional()
    .or(z.literal("")),
});

export type SchemaPasivoUIType = z.infer<typeof schemaPasivoUI>;
