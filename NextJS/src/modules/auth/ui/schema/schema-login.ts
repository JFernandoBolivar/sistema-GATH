/**
 * Schema Zod del formulario de login (paso 12 del checklist §II.8). Mensajes y
 * formatos centralizados en `@/shared/validation` — cero regex inline.
 */
import { z } from "zod";
import { ERROR } from "@/shared/validation/messages";

export const loginFormSchema = z.object({
  usuario: z
    .string()
    .trim()
    .min(1, ERROR.REQUIRED)
    .max(100, ERROR.MAX_LENGTH(100))
    .email(ERROR.INVALID_EMAIL),
  password: z.string().min(1, ERROR.REQUIRED).max(32, ERROR.MAX_LENGTH(32)),
});

export type LoginFormType = z.infer<typeof loginFormSchema>;

