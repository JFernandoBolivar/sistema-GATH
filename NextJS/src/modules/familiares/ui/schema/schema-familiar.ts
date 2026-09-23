import { z } from "zod";
import { REGEX } from "@/shared/validation/regex";

export const familiarSchema = z.object({
  empleadoCedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula del empleado inválida" }),
  cedulaFamiliar: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || REGEX.CEDULA_DIGITOS.test(v), {
      message: "Cédula del familiar inválida",
    }),
  primerNombre: z
    .string()
    .trim()
    .min(2, { message: "Primer nombre debe tener al menos 2 caracteres" })
    .regex(REGEX.SOLO_LETRAS, { message: "Primer nombre solo debe contener letras" }),
  segundoNombre: z
    .string()
    .trim()
    .regex(REGEX.SOLO_LETRAS, { message: "Segundo nombre solo debe contener letras" })
    .optional()
    .nullable(),
  primerApellido: z
    .string()
    .trim()
    .min(2, { message: "Primer apellido debe tener al menos 2 caracteres" })
    .regex(REGEX.SOLO_LETRAS, { message: "Primer apellido solo debe contener letras" }),
  segundoApellido: z
    .string()
    .trim()
    .regex(REGEX.SOLO_LETRAS, { message: "Segundo apellido solo debe contener letras" })
    .optional()
    .nullable(),
  parentescoId: z.number().positive({ message: "Seleccione un parentesco válido" }),
  fechaNacimiento: z
    .string()
    .regex(REGEX.FECHA_ISO, { message: "Formato de fecha inválido (YYYY-MM-DD)" }),
  sexoId: z.number().positive({ message: "Seleccione un sexo válido" }),
  mismoEnte: z.boolean().default(false),
  heredero: z.boolean().default(false),
  observaciones: z.string().optional().nullable(),
});

export type FamiliarFormType = z.infer<typeof familiarSchema>;

/** Cédula de empleado para listar familiares (zero-trust R7). */
export const familiaresPorEmpleadoSchema = z.object({
  cedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula del empleado inválida" }),
});

/** Identificador de familiar (zero-trust R7). */
export const familiarIdSchema = z.object({
  familiarId: z.number().int().positive({ message: "Familiar inválido" }),
});
