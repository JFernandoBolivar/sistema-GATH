import { z } from "zod";

export const schemaGenerar = z.object({
  nombre: z
    .string()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(200, "El nombre es demasiado largo"),
  motivo_id: z.coerce.number().positive("Debe seleccionar un motivo"),
});
