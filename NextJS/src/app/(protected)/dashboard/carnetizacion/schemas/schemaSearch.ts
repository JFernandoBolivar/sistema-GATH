import { z } from "zod";

export const schemaSearch = z.object({
  query: z
    .string()
    .min(2, "Debe ingresar al menos 2 caracteres")
    .max(50, "La búsqueda es demasiado larga"),
});
