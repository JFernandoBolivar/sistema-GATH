import {
  REGEX_EMAIL,
  REGEX_LETTERS,
  REGEX_NUMBERS,
  REGEX_PHONE_VENEZUELA,
  REGEX_PHONE_VENEZUELA_FIJO,
} from "@/lib/regex"
import { z } from "zod"

export const schemaBasicInfo = z.object({
  usuario_id: z.number(),
  cedulaidentidad: z
    .string({
      required_error: "Cédula De Identidad Es Requerido",
    })
    .regex(REGEX_NUMBERS, {
      message: "Solo Se Permiten Números",
    })
    .min(7, { message: "Debe Ingresar Al Menos 7 Digitos" })
    .max(12, { message: "Debe Maximo 12 Digitos" }),
  nombres: z
    .string({
      message: "Debe Ingresar Letras",
      required_error: "El Nombre Completo Es Requerido",
    })
    .regex(REGEX_LETTERS, {
      message: "Solo Se Permiten Letras",
    })
    .min(3, { message: "Debe Ingresar Al Menos 3 Letras" })
    .max(30, {
      message: "Debe Ingresar Maximo 30 Letras",
    }),
  apellidos: z
    .string({
      message: "Debe Ingresar Letras",
      required_error: "El Apellido Completo Es Requerido",
    })
    .regex(REGEX_LETTERS, {
      message: "Solo Se Permiten Letras",
    })
    .min(3, { message: "Debe Ingresar Al Menos 3 Letras" })
    .max(30, {
      message: "Debe Ingresar Maximo 30 Letras",
    }),
  file: z
    .instanceof(File)
    .nullable()
    .refine((file) => file === null || file.size <= 5000000, {
      message: "El Tamaño Maximo De La Imagen Es 5MB",
    }),

  fecha_nacimiento: z
    .date({
      message: "Debe Ingresar Una Fecha Requerida",
      required_error: "La Fecha Es Requerida",
    })
    .refine((date) => date <= new Date(), {
      message: "La Fecha De Nacimiento No Puede Ser En El Futuro",
    })
    .refine(
      (date) => {
        const age = new Date().getFullYear() - date.getFullYear()
        return age >= 16
      },
      {
        message: "La Edad Mínima Es De 16 Años",
      },
    ),

  n_contrato: z.string().optional(),
  sexoid: z.coerce
    .number({
      message: "Debe Ingresar Un Sexo Valido",
      required_error: "El Sexo Es Requerido",
    })
    .refine((val) => !(val === 0), {
      message: "Debe Seleccionar Un Sexo",
    }),
  estadoCivil: z
    .number({
      message: "Debe Ingresar Un Estado Civil Valido",
    })
    .refine((val) => !(val == 0), {
      message: "Debe Seleccionar Un Esttado Civil",
    }),
  correo: z
    .string()
    .regex(REGEX_EMAIL, {
      message: "Solo Se Permiten Correos",
    })
    .optional(),
  telefono_habitacion: z
    .string()
    .regex(REGEX_PHONE_VENEZUELA_FIJO, {
      message:
        "Número inválido. Debe iniciar con un prefijo válido y tener 11 dígitos en total",
    })
    .optional(),
  telefono_movil: z
    .string()
    .regex(REGEX_PHONE_VENEZUELA, {
      message:
        "Número inválido. Debe iniciar con un prefijo válido y tener 11 dígitos en total",
    })
    .optional(),
  carnet_patria: z.string().optional(),
})
export type BasicInfoType = z.infer<typeof schemaBasicInfo>
