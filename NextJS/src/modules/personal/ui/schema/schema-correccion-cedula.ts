/** Validación Zod de la corrección de cédula; el backend vuelve a validar. */
import { z } from "zod";

export const MOTIVO_CEDULA_MIN = 10;
export const MOTIVO_CEDULA_MAX = 500;

const cedula = z
  .string()
  .trim()
  .regex(/^\d{6,9}$/, "La cédula lleva solo dígitos, de 6 a 9.");

export const solicitudCedulaSchema = z
  .object({ cedulaActual: cedula, cedulaNueva: cedula })
  .refine((v) => v.cedulaActual !== v.cedulaNueva, {
    path: ["cedulaNueva"],
    message: "La cédula correcta no puede ser igual a la actual.",
  });

export const ejecutarCedulaSchema = z
  .object({
    cedulaActual: cedula,
    cedulaNueva: cedula,
    motivo: z
      .string()
      .trim()
      .min(MOTIVO_CEDULA_MIN, `Indique el motivo (al menos ${MOTIVO_CEDULA_MIN} caracteres).`)
      .max(MOTIVO_CEDULA_MAX, `El motivo no puede superar ${MOTIVO_CEDULA_MAX} caracteres.`),
    confirmacion: z.string().trim(),
  })
  .refine((v) => v.cedulaActual !== v.cedulaNueva, {
    path: ["cedulaNueva"],
    message: "La cédula correcta no puede ser igual a la actual.",
  })
  .refine((v) => v.confirmacion === v.cedulaNueva, {
    path: ["confirmacion"],
    message: "La confirmación debe ser igual a la cédula correcta.",
  });

/** La confirmación vale solo si se escribió exactamente la cédula correcta. */
export function confirmacionCedulaCoincide(texto: string, cedulaNueva: string): boolean {
  return /^\d{6,9}$/.test(texto.trim()) && texto.trim() === cedulaNueva;
}
