import { LIMITES_TEXTO } from "@/shared/validation/limites-texto";
import { z } from "zod";

/**
 * Longitudes y formatos del expediente (QA 2026-11-04). El backend las vuelve a
 * aplicar en `empleado_escritura_serializers.py`: nunca confiar solo en el front.
 */
export const CEDULA_MIN = 5;
export const CEDULA_MAX = 9;
export const NOMBRE_MIN = 2;
export const NOMBRE_MAX = 60;
export const CORREO_MAX = 254;
export const DIRECCION_MIN = LIMITES_TEXTO.direccion.min;
export const DIRECCION_MAX = LIMITES_TEXTO.direccion.max;

/** Letras (con acentos y ñ), espacios y apóstrofo. */
export const SOLO_LETRAS_ESPACIOS = /^[a-zA-ZáéíóúüñàèìòùÁÉÍÓÚÜÑÀÈÌÒÙ\s'’`]+$/;

/** Cédula del trabajador: solo dígitos, 5 a 9. */
export const cedulaZod = () =>
  z
    .string({ required_error: "La cédula es requerida" })
    .trim()
    .regex(/^\d*$/, { message: "La cédula solo admite números" })
    .min(CEDULA_MIN, { message: `La cédula debe tener al menos ${CEDULA_MIN} dígitos` })
    .max(CEDULA_MAX, { message: `La cédula debe tener máximo ${CEDULA_MAX} dígitos` });

/** Nombres o apellidos: letras y espacios, 2 a 60. */
export const nombreZod = (etiqueta: string) =>
  z
    .string({ required_error: `${etiqueta} es requerido` })
    .trim()
    .min(NOMBRE_MIN, { message: `${etiqueta} debe tener al menos ${NOMBRE_MIN} letras` })
    .max(NOMBRE_MAX, { message: `${etiqueta} admite máximo ${NOMBRE_MAX} caracteres` })
    .regex(SOLO_LETRAS_ESPACIOS, { message: `${etiqueta} solo admite letras y espacios` });
