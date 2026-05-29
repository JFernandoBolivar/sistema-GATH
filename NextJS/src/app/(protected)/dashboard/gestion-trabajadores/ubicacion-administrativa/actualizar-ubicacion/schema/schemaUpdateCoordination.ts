import { REGEX_NUMBERS } from "@/lib/regex";
import z from "zod";

export const schemaUpgradeCoordination = z.object({
  Codigo: z
    .string({
      required_error: "Este Campo Es Requerido",
    })
    .regex(REGEX_NUMBERS, {
      message: "Solo se permiten numeros",
    })
    .min(6, {
      message: "Minimo 6 Caracteres",
    })
    .refine((v) => Number.parseInt(v), {
      message: "Debe Ingresar Numeros",
    }),
  coordinacion: z
    .string({
      required_error: "Este Campo Es Requerido",
    })
    .min(3, {
      message: "Minimo 3 Caracteres",
    }),
  dependenciaId: z.coerce
    .number({
      invalid_type_error: "Información Invalida",
    })
    .min(1, {
      message: "Debe Seleccionar Una Depedencia",
    }),
  direccionGeneral: z.coerce
    .number({
      invalid_type_error: "Información Invalida",
    })
    .min(1, {
      message: "Debe Seleccionar Una Direccion General",
    }),
  direccionLinea: z.coerce
    .number({
      invalid_type_error: "Información Invalida",
    })
    .min(1, {
      message: "Debe Seleccionar Una Direccion De Linea",
    }),
  id: z.coerce
    .number({
      invalid_type_error: "Información Invalida",
    })
    .min(1, {
      message: "Debe Seleccionar Una Coordinación",
    }),
});

export type SchemaUpgradeCoordination = z.infer<
  typeof schemaUpgradeCoordination
>;
