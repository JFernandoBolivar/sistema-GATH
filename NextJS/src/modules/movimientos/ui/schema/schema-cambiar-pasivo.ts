import { z } from "zod";

export const schemaPasivoUI = z.object({
  estatus_id: z.number().min(1, { message: "Debe seleccionar un estatus" }),
  motivo: z.number().min(1, { message: "El motivo es requerido" }),
  tiponominaid: z.number().optional().default(0),
  liberar_activos: z.boolean().default(false),
});

export type SchemaPasivoUIType = z.infer<typeof schemaPasivoUI>;
