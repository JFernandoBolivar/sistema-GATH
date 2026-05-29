import { REGEX_NUMBERS } from "@/lib/regex";
import z from "zod";

export const schemaUpgradeDireccionGeneralCoord = z.object({
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
  direccion_general: z
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
  id: z.coerce
    .number({
      invalid_type_error: "Información Invalida",
    })
    .min(1, {
      message: "Debe Seleccionar Una Dirección / Gerencia / Oficina",
    }),
});

export type SchemaUpgradeDireccionGeneralCoord = z.infer<
  typeof schemaUpgradeDireccionGeneralCoord
>;
