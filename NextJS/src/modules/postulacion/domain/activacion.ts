/**
 * Activación del acceso con el enlace del correo (D-10): el postulante confirma su cédula (segundo factor)
 * y crea su contraseña. Las reglas de la contraseña son las del cambio de clave (espejo del backend).
 */
import { z } from "zod";
import { CEDULA_POSTULANTE } from "./credenciales";
import { evaluarClaveNueva, LONGITUD_MAXIMA_CLAVE, type ReglaClave } from "./clave";

/** Forma del token (`secrets.token_urlsafe(32)` = 43 caracteres): se descarta lo evidentemente inválido sin ir al servidor. */
export const FORMA_TOKEN_ENLACE = /^[A-Za-z0-9_-]{20,200}$/;

export function tokenConForma(token: string | null | undefined): token is string {
  return typeof token === "string" && FORMA_TOKEN_ENLACE.test(token);
}

/** Reglas visibles de la contraseña: sin «distinta de la temporal» (en la activación no hay temporal). */
export function reglasDeActivacion(clave: string, cedula: string): { reglas: ReglaClave[]; valida: boolean } {
  const { reglas } = evaluarClaveNueva(clave, { cedula, claveActual: "" });
  const visibles = reglas.filter((r) => r.id !== "distinta");
  return { reglas: visibles, valida: visibles.every((r) => r.cumple) };
}

export const esquemaActivacion = z
  .object({
    cedula: z
      .string({ required_error: "Escribe tu cédula" })
      .trim()
      .min(1, "Escribe tu cédula")
      .regex(CEDULA_POSTULANTE, "La cédula solo lleva números (de 5 a 10 dígitos)"),
    claveNueva: z
      .string({ required_error: "Escribe tu contraseña nueva" })
      .min(1, "Escribe tu contraseña nueva")
      .max(LONGITUD_MAXIMA_CLAVE, "La contraseña es demasiado larga"),
    confirmacion: z.string({ required_error: "Repite tu contraseña" }).min(1, "Repite tu contraseña"),
  })
  .superRefine((v, ctx) => {
    if (v.claveNueva && !reglasDeActivacion(v.claveNueva, v.cedula).valida) {
      ctx.addIssue({ code: "custom", path: ["claveNueva"], message: "La contraseña no cumple las reglas indicadas." });
    }
    if (v.confirmacion && v.claveNueva !== v.confirmacion) {
      ctx.addIssue({ code: "custom", path: ["confirmacion"], message: "Las contraseñas no coinciden." });
    }
  });

export type ValoresActivacion = z.infer<typeof esquemaActivacion>;
