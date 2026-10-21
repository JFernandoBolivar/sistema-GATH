/**
 * Schemas Zod para recuperación y restablecimiento de contraseña.
 * Cumple con validaciones de longitud y coincidencia de clave.
 */
import { z } from "zod";
import { ERROR } from "@/shared/validation/messages";

export const solicitarRecuperacionSchema = z.object({
  identificador: z
    .string()
    .trim()
    .min(3, "Debe ingresar una cédula o correo institucional válido.")
    .max(150, ERROR.MAX_LENGTH(150)),
});

export type SolicitarRecuperacionFormType = z.infer<typeof solicitarRecuperacionSchema>;

export const restablecerPasswordSchema = z
  .object({
    token: z.string().min(1, "El token de recuperación es obligatorio."),
    passwordNuevo: z
      .string()
      .min(8, ERROR.MIN_LENGTH(8))
      .max(128, ERROR.MAX_LENGTH(128)),
    passwordConfirmacion: z.string().min(1, ERROR.REQUIRED),
  })
  .refine((data) => data.passwordNuevo === data.passwordConfirmacion, {
    message: "Las contraseñas no coinciden",
    path: ["passwordConfirmacion"],
  });

export type RestablecerPasswordFormType = z.infer<typeof restablecerPasswordSchema>;
