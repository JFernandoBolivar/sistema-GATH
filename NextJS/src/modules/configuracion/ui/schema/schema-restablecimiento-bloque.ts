/** Validación Zod del restablecimiento de contraseñas en bloque (U2); el backend vuelve a validar. */
import { z } from "zod";

export const MOTIVO_BLOQUE_MIN = 10;
export const MOTIVO_BLOQUE_MAX = 500;
export const ADVERTENCIA_TODOS =
  "Se cambiará la clave también a quienes ya pusieron la suya y se cerrarán sus sesiones";

export const solicitudBloqueSchema = z.object({
  clasificacion: z.enum(["ACTIVOS", "PASIVOS", "AMBOS"]),
  alcance: z.enum(["VENCIDA", "SIN_PRIMER_INGRESO", "TODOS"]),
  enviarCorreo: z.boolean(),
  motivo: z
    .string()
    .trim()
    .min(MOTIVO_BLOQUE_MIN, `Indique el motivo (al menos ${MOTIVO_BLOQUE_MIN} caracteres).`)
    .max(MOTIVO_BLOQUE_MAX, `El motivo no puede superar ${MOTIVO_BLOQUE_MAX} caracteres.`),
});

export const ejecutarBloqueSchema = solicitudBloqueSchema.extend({
  confirmacion: z.number().int().min(0),
});

/** La confirmación vale solo si se escribió exactamente el total calculado. */
export function confirmacionCoincide(texto: string, total: number): boolean {
  const limpio = texto.trim();
  return /^\d+$/.test(limpio) && Number(limpio) === total;
}
