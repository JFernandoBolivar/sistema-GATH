/**
 * Schema Zod del módulo identidad (paso 12 del checklist §II.8). Mensajes y
 * formatos centralizados en `@/shared/validation` — cero regex inline.
 */
import { z } from "zod";
import { ERROR } from "@/shared/validation/messages";
import { SAFE_TEXT, SAFE_TEXT_MSG } from "@/shared/validation/regex";

/** Filtros opcionales del listado de usuarios (se re-validan en la Server Action). */
export const usuariosFiltrosSchema = z.object({
  busqueda: z
    .string()
    .trim()
    .max(100, ERROR.MAX_LENGTH(100))
    .regex(SAFE_TEXT, SAFE_TEXT_MSG)
    .optional()
    .or(z.literal("")),
});

export type UsuariosFiltrosType = z.infer<typeof usuariosFiltrosSchema>;
