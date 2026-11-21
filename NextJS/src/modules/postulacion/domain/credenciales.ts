import { z } from "zod";

/** Cédula del postulante: solo dígitos, de 5 a 10 (misma regla del backend). */
export const CEDULA_POSTULANTE = /^\d{5,10}$/;

export const credencialesPostulanteSchema = z.object({
  cedula: z
    .string({ required_error: "Escribe tu cédula" })
    .trim()
    .min(1, "Escribe tu cédula")
    .regex(CEDULA_POSTULANTE, "La cédula solo lleva números (de 5 a 10 dígitos)"),
  password: z
    .string({ required_error: "Escribe tu contraseña" })
    .min(1, "Escribe tu contraseña")
    .max(128, "La contraseña es demasiado larga"),
});

export type CredencialesPostulante = z.infer<typeof credencialesPostulanteSchema>;
