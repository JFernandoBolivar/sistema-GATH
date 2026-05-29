import { REGEX_NUMBERS } from "@/lib/regex";
import z from "zod";

export const schemaCode = z.object({
  codigo: z.string().regex(REGEX_NUMBERS, {
    message: "Solo Se Permiten Numeros",
  }),
  denominacioncargoid: z.number().min(1, {
    message: "Debe Seleccionar Una D. Cargo",
  }),
  denominacioncargoespecificoid: z.number().min(1, {
    message: "Debe Seleccionar Una D. Cargo Especifico",
  }),
  gradoid: z.number().optional(),
  tiponominaid: z.number().min(1, {
    message: "Debe Seleccionar un tipo de nomina",
  }),
  Dependencia: z.number().min(1, {
    message: "Debe Seleccionar un nivel",
  }),
  DireccionGeneral: z.number().min(1, {
    message: "Debe Seleccionar una Gerencia u Oficina",
  }),
  DireccionLinea: z.number().default(0),
  Coordinacion: z.number().default(0),
});
