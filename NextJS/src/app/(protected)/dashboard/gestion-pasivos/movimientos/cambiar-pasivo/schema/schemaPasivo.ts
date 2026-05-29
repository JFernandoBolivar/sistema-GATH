import z from "zod";
const survivorSchema = z.object({
  cedula_familiar: z.string(),
  codigo: z.string().optional(),
});
export const schemaPasivo = z.object({
  estatus_id: z.number(),
  usuario_id: z.number(),
  motivo: z.coerce
    .number()

    .optional(),
  sobrevivientes: z.array(survivorSchema).optional(),
});
