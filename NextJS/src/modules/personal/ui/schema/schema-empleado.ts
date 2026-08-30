import { z } from "zod";
import { REGEX } from "@/shared/validation/regex";

export const empleadoSchema = z.object({
  cedula: z
    .string()
    .trim()
    .min(5, { message: "Cédula debe tener al menos 5 caracteres" })
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula solo debe contener dígitos" }),
  nombres: z
    .string()
    .trim()
    .min(2, { message: "Nombres debe tener al menos 2 caracteres" })
    .regex(REGEX.SOLO_LETRAS, { message: "Nombres solo debe contener letras" }),
  apellidos: z
    .string()
    .trim()
    .min(2, { message: "Apellidos debe tener al menos 2 caracteres" })
    .regex(REGEX.SOLO_LETRAS, { message: "Apellidos solo debe contener letras" }),
  sexoId: z.number().positive({ message: "Seleccione un sexo válido" }),
  fechaNacimiento: z
    .string()
    .regex(REGEX.FECHA_ISO, { message: "Formato de fecha inválido (YYYY-MM-DD)" }),
  correo: z
    .string()
    .trim()
    .email({ message: "Correo inválido" })
    .optional()
    .nullable(),
  telefonoMovil: z
    .string()
    .trim()
    .regex(REGEX.TELEFONO, { message: "Teléfono inválido (ej: 04121234567)" })
    .optional()
    .nullable(),
  telefonoHabitacion: z.string().trim().optional().nullable(),
  estadoCivilId: z.number().positive().optional().nullable(),
  carnetPatria: z.string().trim().optional().nullable(),
});

export type EmpleadoFormType = z.infer<typeof empleadoSchema>;

/** Filtro de listado de empleados (zero-trust R7). */
export const listadoEmpleadosSchema = z.object({
  busqueda: z.string().trim().max(100, { message: "Búsqueda demasiado larga" }).optional(),
});
export type ListadoEmpleadosFormType = z.infer<typeof listadoEmpleadosSchema>;

/** Cédula de empleado (zero-trust R7). */
export const empleadoCedulaSchema = z.object({
  cedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula inválida" }),
});
