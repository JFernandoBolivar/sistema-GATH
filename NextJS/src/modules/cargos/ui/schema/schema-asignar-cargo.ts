import { z } from "zod";
import { REGEX } from "@/shared/validation/regex";

export const asignarCargoSchema = z.object({
  cargoId: z.number().positive({ message: "Debe seleccionar un cargo válido" }),
  empleadoCedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula debe contener solo dígitos" }),
});

/** Filtro de listado de cargos (zero-trust R7). */
export const cargosFiltroSchema = z.object({
  dependenciaId: z.number().int().positive().optional().nullable(),
  soloVacantes: z.boolean().optional(),
});

/** Identificador de cargo para desasignar (zero-trust R7). */
export const desasignarCargoSchema = z.object({
  cargoId: z.number().int().positive({ message: "Debe seleccionar un cargo válido" }),
});

export type AsignarCargoFormType = z.infer<typeof asignarCargoSchema>;
