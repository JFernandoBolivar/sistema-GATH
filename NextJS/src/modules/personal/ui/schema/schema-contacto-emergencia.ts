import { z } from "zod";
import { REGEX } from "@/shared/domain/validation";

/**
 * Contacto de emergencia del trabajador (tabla `contacto_emergencia`:
 * nombres, apellidos, teléfono y parentesco de `RAC_parentesco`). Se usa en el
 * paso 1 del wizard de registro y en el diálogo de /personal/consultar.
 */
const SOLO_LETRAS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;

export const contactoEmergenciaFormSchema = z.object({
  nombres: z
    .string({ required_error: "Los Nombres Son Requeridos" })
    .trim()
    .min(2, { message: "Debe Ingresar Al Menos 2 Letras" })
    .max(100, { message: "Debe Ingresar Maximo 100 Letras" })
    .regex(SOLO_LETRAS, { message: "Solo Se Permiten Letras" }),
  apellidos: z
    .string({ required_error: "Los Apellidos Son Requeridos" })
    .trim()
    .min(2, { message: "Debe Ingresar Al Menos 2 Letras" })
    .max(100, { message: "Debe Ingresar Maximo 100 Letras" })
    .regex(SOLO_LETRAS, { message: "Solo Se Permiten Letras" }),
  telefono: z
    .string({ required_error: "El Teléfono Es Requerido" })
    .trim()
    .refine((v) => REGEX.PHONE_VE.test(v) || REGEX.PHONE_VE_FIJO.test(v), {
      message: "Número inválido. Debe iniciar con un prefijo válido y tener 11 dígitos en total",
    }),
  relacion_id: z
    .number({ message: "Debe Seleccionar Un Parentesco" })
    .refine((v) => v > 0, { message: "Debe Seleccionar Un Parentesco" }),
});

export const contactosEmergenciaFormSchema = z.object({
  contacto_emergencia: z.array(contactoEmergenciaFormSchema).max(5, { message: "Máximo 5 contactos de emergencia" }),
});

export type ContactoEmergenciaFormType = z.infer<typeof contactoEmergenciaFormSchema>;
export type ContactosEmergenciaFormType = z.infer<typeof contactosEmergenciaFormSchema>;

export const contactoEmergenciaVacio = (): ContactoEmergenciaFormType =>
  ({ nombres: "", apellidos: "", telefono: "", relacion_id: 0 }) as ContactoEmergenciaFormType;

/** Formulario -> DTO de escritura (`GuardarEmpleadoInputDTO.contactoEmergencia`). */
export function contactosFormADto(contactos: ContactoEmergenciaFormType[] | undefined) {
  return (contactos ?? []).map((c) => ({
    nombres: c.nombres.trim(),
    apellidos: c.apellidos.trim(),
    telefono: c.telefono.trim(),
    relacionId: c.relacion_id,
  }));
}
