import { z } from "zod";
import { CEDULA_NUM, CEDULA_NUM_MSG, EMAIL, EMAIL_MSG, NAME_EDICION } from "@/shared/domain/validation";
import { telefonoZod } from "@/shared/domain/validation/telefono";

export const LIMITES_POSTULANTE = { nombres: 150, apellidos: 150, correo: 254 } as const;

function nombre(sujeto: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, `Indique ${sujeto}.`)
    .max(max, `Máximo ${max} caracteres.`)
    .regex(NAME_EDICION, `${sujeto[0].toUpperCase()}${sujeto.slice(1)}: solo se admiten letras y espacios.`);
}

/** Formulario «Nuevo postulante»: mismas reglas que el backend (cédula numérica, nombres solo letras). */
export const esquemaNuevoPostulante = z.object({
  cedula: z.string().trim().min(1, "Indique la cédula.").regex(CEDULA_NUM, CEDULA_NUM_MSG),
  nombres: nombre("los nombres", LIMITES_POSTULANTE.nombres),
  apellidos: nombre("los apellidos", LIMITES_POSTULANTE.apellidos),
  correo: z
    .string()
    .trim()
    .max(LIMITES_POSTULANTE.correo, `Máximo ${LIMITES_POSTULANTE.correo} caracteres.`)
    .refine((v) => v === "" || EMAIL.test(v), EMAIL_MSG),
  telefonoMovil: telefonoZod({ tipo: "movil" }),
});

export type ValoresNuevoPostulante = z.input<typeof esquemaNuevoPostulante>;

export const VALORES_INICIALES_POSTULANTE = {
  cedula: "",
  nombres: "",
  apellidos: "",
  correo: "",
  telefonoMovil: "",
} satisfies ValoresNuevoPostulante;
