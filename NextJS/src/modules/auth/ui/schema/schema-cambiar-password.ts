/**
 * Schema Zod del formulario de cambio de contraseña propia. Mensajes y
 * formatos centralizados en `@/shared/validation` — cero regex inline.
 * Antes vivía como `changePasswordSchema` en `src/lib/zod.ts` (fuera de
 * cualquier módulo); se consolida aquí junto al resto de schemas de `auth`.
 */
import { z } from "zod";
import { ERROR } from "@/shared/validation/messages";

export const cambiarPasswordFormSchema = z
  .object({
    current_password: z.string().min(1, ERROR.REQUIRED),
    new_password: z
      .string()
      .min(8, ERROR.MIN_LENGTH(8))
      .max(32, ERROR.MAX_LENGTH(32)),
    confirm_password: z.string().min(1, ERROR.REQUIRED),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Las contraseñas no coinciden",
    path: ["confirm_password"],
  });

export type CambiarPasswordFormType = z.infer<typeof cambiarPasswordFormSchema>;
