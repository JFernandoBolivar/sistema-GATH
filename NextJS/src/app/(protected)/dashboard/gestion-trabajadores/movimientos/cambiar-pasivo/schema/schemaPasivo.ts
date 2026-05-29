import z from "zod";

export const schemaPasivo = z.object({
  estatus_id: z.number(),
  usuario_id: z.number(),
  motivo: z.number().refine((value) => value > 0, {
    message: "El motivo es requerido",
  }),
  tiponominaid: z.number(),
  codigo_nuevo: z.string().optional(),
  liberar_activos: z.boolean().default(false),
});
