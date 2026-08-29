import { z } from "zod";
import { REGEX } from "@/shared/validation/regex";

export const emitirCarnetSchema = z.object({
  empleadoCedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula inválida" }),
  motivoId: z.number().positive({ message: "Seleccione un motivo de emisión" }),
  observaciones: z.string().trim().optional(),
});

/** Hash de seguridad de carnet (zero-trust R7). */
export const validarHashSchema = z.object({
  securityHash: z
    .string()
    .trim()
    .min(8, { message: "Hash de seguridad inválido" })
    .max(128, { message: "Hash de seguridad inválido" })
    .regex(REGEX.NO_HTML, { message: "Hash de seguridad inválido" }),
});

/** Identificador de carnet (zero-trust R7). */
export const carnetIdSchema = z.object({
  carnetId: z.number().int().positive({ message: "Carnet inválido" }),
});

/** Identificador de plantilla (zero-trust R7). */
export const plantillaIdSchema = z.object({
  plantillaId: z.number().int().positive({ message: "Plantilla inválida" }),
});

export type EmitirCarnetFormType = z.infer<typeof emitirCarnetSchema>;
