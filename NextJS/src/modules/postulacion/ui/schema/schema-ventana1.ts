import { z } from "zod";
import { telefonoZod } from "@/shared/domain/validation/telefono";
import { EMAIL, EMAIL_MSG } from "@/shared/validation";
import { LIMITES_VENTANA1 } from "../../domain/ventana1";

const SOLO_LETRAS = /^[\p{L}][\p{L}\s'’.-]*$/u;
const MSG_LETRAS = "Usa solo letras";

const nombre = (etiqueta: string, max: number) =>
  z
    .string({ required_error: `Escribe ${etiqueta}` })
    .trim()
    .min(1, `Escribe ${etiqueta}`)
    .max(max, `Máximo ${max} caracteres`)
    .regex(SOLO_LETRAS, MSG_LETRAS);

const aTexto = (v: string | null | undefined) => v ?? "";

/** `AAAA-MM-DD` real, posterior a 1900 y no futura. */
function fechaValida(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "Escribe una fecha válida";
  const fecha = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) {
    return "Escribe una fecha válida";
  }
  if (fecha.getUTCFullYear() < 1900) return "Escribe una fecha válida";
  if (fecha.getTime() > Date.now()) return "La fecha de nacimiento no puede ser futura";
  return null;
}

/** Valida el borrador: solo nombres y apellidos son obligatorios; lo demás, si se escribe, debe ser válido. */
export const esquemaVentana1 = z.object({
  nombres: nombre("tus nombres", LIMITES_VENTANA1.nombres),
  apellidos: nombre("tus apellidos", LIMITES_VENTANA1.apellidos),
  correo: z
    .string()
    .trim()
    .max(LIMITES_VENTANA1.correo, `Máximo ${LIMITES_VENTANA1.correo} caracteres`)
    .refine((v) => v === "" || EMAIL.test(v), EMAIL_MSG),
  telefonoMovil: telefonoZod({ tipo: "movil" }).transform(aTexto),
  fechaNacimiento: z.string().superRefine((v, ctx) => {
    if (!v) return;
    const problema = fechaValida(v);
    if (problema) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problema });
  }),
  sexo: z.enum(["", "M", "F"]),
  nacionalidad: z.enum(["", "V", "E"]),
  estadoCivil: z.string().trim().max(30, "Máximo 30 caracteres"),
  direccionHabitacion: z
    .string()
    .trim()
    .max(LIMITES_VENTANA1.direccion, `Máximo ${LIMITES_VENTANA1.direccion} caracteres`),
  telefonoAlterno: telefonoZod({ tipo: "cualquiera" }).transform(aTexto),
  contactoEmergencia: z.object({
    nombre: z
      .string()
      .trim()
      .max(LIMITES_VENTANA1.contactoNombre, `Máximo ${LIMITES_VENTANA1.contactoNombre} caracteres`)
      .refine((v) => v === "" || SOLO_LETRAS.test(v), MSG_LETRAS),
    telefono: telefonoZod({ tipo: "cualquiera" }).transform(aTexto),
    parentesco: z
      .string()
      .trim()
      .max(LIMITES_VENTANA1.contactoParentesco, `Máximo ${LIMITES_VENTANA1.contactoParentesco} caracteres`),
  }),
});

export type EntradaVentana1 = z.input<typeof esquemaVentana1>;
