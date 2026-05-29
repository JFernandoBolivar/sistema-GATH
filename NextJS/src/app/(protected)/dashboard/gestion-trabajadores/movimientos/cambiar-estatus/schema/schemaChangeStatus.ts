import z from "zod";

export const schemaStatusChange = z.object({
  estatus_id: z.number(),
  motivo: z.number().refine((value) => value > 0, {
    message: "El motivo es requerido",
  }),
  cargo: z.number(),
});
