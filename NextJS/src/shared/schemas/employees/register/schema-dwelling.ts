import { z } from "zod";

export const schemaDwelling = z.object({
  datos_vivienda: z.object({
    direccion_exacta: z
      .string({
        message: "Debe Ingresar Información Valida",
        required_error: "Este Campo Es Requerido",
      })
      .min(3, "La Direccion Exacta Debe Tener Minimo 3 Caracteres"),
    estado_id: z
      .number({
        message: "Debe Ingresar Información Valida",
        required_error: "Este Campo Es Requerido",
      })
      .min(1, "Debe Seleccionar Un Estado"),
    municipio_id: z
      .number({
        message: "Debe Ingresar Información Valida",
        required_error: "Este Campo Es Requerido",
      })
      .min(1, "Debe Seleccionar Un Municipio"),
    parroquia: z
      .number({
        message: "Debe Ingresar Información Valida",
        required_error: "Este Campo Es Requerido",
      })
      .min(1, "Debe Seleccionar Una Parroquia"),
    condicion_vivienda_id: z
      .number({
        message: "Debe Ingresar Información Valida",
        required_error: "Este Campo Es Requerido",
      })
      .min(1, "Debe Seleccionar Una Parroquia"),
    codigo_postal: z.string().max(10, "Máximo 10 caracteres").optional(),
  }),
});
export type DwellingType = z.infer<typeof schemaDwelling>;
