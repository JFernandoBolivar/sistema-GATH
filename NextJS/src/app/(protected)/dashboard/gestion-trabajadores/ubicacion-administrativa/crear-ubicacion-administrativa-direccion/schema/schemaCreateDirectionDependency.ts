import { REGEX_LETTERS, REGEX_NUMBERS } from "@/lib/regex";
import z from "zod";

export const schemaCreateDirectionGeneralDp = z.object({
  dependenciaId: z.number(),
  Codigo: z
    .string({
      message: "Datos Incorrecos",
      required_error: "Datos Invalidos",
    })
    .trim()
    .regex(REGEX_NUMBERS, {
      message: "Solo se permiten numeros",
    })
    .min(6, {
      message: "Minimo 6 Caracteres",
    }),
  direccion_general: z
    .string({
      message: "Datos Incorrecos",
      required_error: "Datos Invalidos",
    })
    .regex(REGEX_LETTERS, {
      message: "Solo se letras y espaciado",
    })
    .min(12, {
      message: "Minimo 12 Caracteres",
    }),
});
export const schemaCreateDirectionLineDirection = z.object({
  direccionGeneral: z.number(),
  Codigo: z
    .string({
      message: "Datos Incorrecos",
      required_error: "Datos Invalidos",
    })
    .regex(REGEX_NUMBERS, {
      message: "Solo se permiten numeros",
    })

    .min(6, {
      message: "Minimo 6 Caracteres",
    }),
  direccion_linea: z
    .string({
      message: "Datos Incorrecos",
      required_error: "Datos Invalidos",
    })
    .regex(REGEX_LETTERS, {
      message: "Solo se letras y espaciado",
    })
    .min(12, {
      message: "Minimo 12 Caracteres",
    }),
});
export const schemaCreateCoordinationDirection = z.object({
  direccionLinea: z.number(),
  Codigo: z
    .string({
      message: "Datos Incorrecos",
      required_error: "Datos Invalidos",
    })
    .regex(REGEX_NUMBERS, {
      message: "Solo se permiten numeros",
    })
    .min(6, {
      message: "Minimo 6 Caracteres",
    }),
  coordinacion: z
    .string({
      message: "Datos Incorrecos",
      required_error: "Datos Invalidos",
    })
    .regex(REGEX_LETTERS, {
      message: "Solo se letras y espaciado",
    })
    .min(12, {
      message: "Minimo 12 Caracteres",
    }),
});
