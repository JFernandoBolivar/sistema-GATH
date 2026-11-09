import { z } from "zod";
import { NO_HTML, NO_HTML_MSG } from "./regex";
import { LIMITES_TEXTO, type LimiteTexto } from "@/shared/domain/validation/limites-texto";

export { LIMITES_TEXTO, type LimiteTexto };

/** Texto libre obligatorio: `.trim().min().max()` con mensajes en español. */
export const textoLibreRequerido = (nombre: string, limite: LimiteTexto) =>
  z
    .string({ required_error: `${nombre} es un campo obligatorio` })
    .trim()
    .min(1, `${nombre} es un campo obligatorio`)
    .min(limite.min, `${nombre} debe tener al menos ${limite.min} caracteres`)
    .max(limite.max, `${nombre} no puede superar ${limite.max} caracteres`)
    .regex(NO_HTML, NO_HTML_MSG);

/** Texto libre opcional: vacío es válido; si se escribe, respeta mínimo y máximo. */
export const textoLibreOpcional = (nombre: string, limite: LimiteTexto) =>
  z
    .string()
    .trim()
    .max(limite.max, `${nombre} no puede superar ${limite.max} caracteres`)
    .refine((v) => v.length === 0 || v.length >= limite.min, `${nombre} debe tener al menos ${limite.min} caracteres`)
    .refine((v) => v.length === 0 || NO_HTML.test(v), NO_HTML_MSG)
    .optional();
