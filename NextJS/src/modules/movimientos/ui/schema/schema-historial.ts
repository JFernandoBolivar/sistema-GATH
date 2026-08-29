/**
 * Schema Zod de entrada para consultar el historial de movimientos de cargo
 * por empleado (cédula) o por cargo (código de puesto). Mensajes y formatos
 * centralizados en `@/shared/validation` — cero regex inline.
 */
import { z } from "zod";
import { ERROR } from "@/shared/validation/messages";
import { REGEX } from "@/shared/validation/regex";

export const historialEmpleadoSchema = z.object({
  empleadoCedula: z
    .string()
    .trim()
    .min(1, ERROR.REQUIRED)
    .regex(REGEX.CEDULA_DIGITOS, { message: ERROR.INVALID_CEDULA }),
});

export const historialCargoSchema = z.object({
  codigoPuesto: z
    .string()
    .trim()
    .min(3, ERROR.MIN_LENGTH(3))
    .max(64, ERROR.MAX_LENGTH(64))
    .regex(REGEX.SAFE_TEXT, { message: "Código de puesto inválido" }),
});

export type HistorialEmpleadoFormType = z.infer<typeof historialEmpleadoSchema>;
export type HistorialCargoFormType = z.infer<typeof historialCargoSchema>;
