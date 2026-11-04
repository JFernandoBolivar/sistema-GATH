import { z } from "zod";

export const actualizarConfiguracionVisualSchema = z.object({
  tipoCintillo: z.enum(["GENERICO", "FIJO"]).optional(),
  // Vacío se normaliza a `null` al enviar (cintillo genérico o sin nombre); si se
  // escribe un nombre, se exige una longitud mínima razonable además del tope.
  nombreEmpresa: z
    .string()
    .trim()
    .max(200, { message: "El nombre de la empresa no puede superar 200 caracteres." })
    .refine((valor) => valor.length === 0 || valor.length >= 2, {
      message: "El nombre de la empresa debe tener al menos 2 caracteres.",
    })
    .optional()
    .nullable(),
  colorFondo: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/, { message: "El color de fondo debe ser un hexadecimal válido (ej. #1E3A8A)." })
    .optional()
    .nullable(),
});

export type ActualizarConfiguracionVisualFormType = z.infer<typeof actualizarConfiguracionVisualSchema>;

export const campoLogoSchema = z.enum(["logo_principal_clave", "logo_secundario_clave", "cintillo_pie_clave"]);
