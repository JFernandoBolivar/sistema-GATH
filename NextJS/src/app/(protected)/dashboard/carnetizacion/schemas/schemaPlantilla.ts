import { z } from "zod";

export const schemaPlantilla = z.object({
  nombre: z
    .string()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(100, "El nombre es demasiado largo"),
  imagen: z
    .instanceof(File)
    .refine(
      (file) => ["image/jpeg", "image/png", "image/jpg"].includes(file.type),
      "Solo se permiten imágenes JPG o PNG",
    )
    .refine((file) => file.size <= 5 * 1024 * 1024, "La imagen no debe superar los 5MB"),
});
