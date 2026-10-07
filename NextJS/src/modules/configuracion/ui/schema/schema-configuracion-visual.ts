import { z } from "zod";

export const actualizarConfiguracionVisualSchema = z.object({
  tipoCintillo: z.enum(["GENERICO", "FIJO"]).optional(),
  nombreEmpresa: z.string().trim().max(200).optional().nullable(),
  colorFondo: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/, { message: "El color de fondo debe ser un hexadecimal válido (ej. #1E3A8A)." })
    .optional()
    .nullable(),
});

export type ActualizarConfiguracionVisualFormType = z.infer<typeof actualizarConfiguracionVisualSchema>;

export const campoLogoSchema = z.enum(["logo_principal_clave", "logo_secundario_clave", "cintillo_pie_clave"]);
