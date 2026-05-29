import { REGEX_NUMBERS } from "@/lib/regex";
import z from "zod";

export const schemaUpgradeDependnecy = z.object({
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
  dependencia: z
    .string({
      required_error: "Este Campo Es Requerido",
    })
    .min(3, {
      message: "Minimo 3 Caracteres",
    }),
  id: z.coerce
    .number({
      invalid_type_error: "Información Invalida",
    })
    .min(1, {
      message: "Debe Seleccionar Una Depedencia",
    }),
});

export type SchemaUpgradeDependnecyType = z.infer<
  typeof schemaUpgradeDependnecy
>;
