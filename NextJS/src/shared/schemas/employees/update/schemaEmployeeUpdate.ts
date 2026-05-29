import { REGEX_PHONE_VENEZUELA, REGEX_PHONE_VENEZUELA_FIJO } from "@/lib/regex"
import { z } from "zod"

export const schemaBasicUpdateInfo = z.object({
  nombres: z
    .string({
      message: "Debe Ingresar Letras",
    })
    .optional(),
  apellidos: z
    .string({
      message: "Debe Ingresar Letras",
    })
    .optional(),
  file: z
    .instanceof(File)
    .nullable()
    .refine((file) => file !== null, {
      message: "Debe Ingresar Una Imagen De Perfil",
    })
    .refine((file) => file === null || file.size <= 5000000, {
      message: "El Tamaño Maximo De La Imagen Es 5MB",
    })
    .optional(),
  fecha_nacimiento: z
    .date({
      message: "Debe Ingresar Una Fecha Requerida",
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
    )
    .optional(),
  sexoid: z
    .number({
      message: "Debe Ingresar Un Sexo Valido",
    })
    .refine((val) => !(val === 0), {
      message: "Debe Seleccionar Un Sexo",
    })
    .optional(),
  estadoCivil: z
    .number({
      errorMap: () => ({ message: "Debe Seleccionar Un Estado Civil" }),
    })
    .refine((val) => !(val == 0), {
      message: "Debe Seleccionar Un Esttado Civil",
    })
    .optional(),
  correo: z.string().optional(),
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
})
export type BasicInfoUpdateType = z.infer<typeof schemaBasicUpdateInfo>
