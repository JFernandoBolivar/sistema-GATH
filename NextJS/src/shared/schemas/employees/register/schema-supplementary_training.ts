import { z } from "zod"

export const schemaFormacionComplementaria = z
  .object({
    capacitacion_id: z
      .number({ message: "Debe seleccionar una capacitación" })
      .min(1, { message: "Debe seleccionar una capacitación" }),
    nueva_capacitacion_nombre: z.string().optional(),
    institucion_id: z
      .number({ message: "Debe seleccionar una institución" })
      .min(1, { message: "Debe seleccionar una institución" }),
    nueva_institucion_nombre: z.string().optional(),
    procedencia_id: z
      .number({ message: "Debe seleccionar una procedencia" })
      .min(1, { message: "Debe seleccionar una procedencia" }),
    horas_completadas: z.string().optional(),
    grupo_id: z.number().optional(),
    fecha_inicio: z
      .date({
        message: "Debe Ingresar Información Valida",
        required_error: "Este Campo Es Requerido",
      })
      .optional(),
    fecha_fin: z
      .date({
        message: "Debe Ingresar Información Valida",
        required_error: "Este Campo Es Requerido",
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fecha_inicio && data.fecha_fin) {
      if (data.fecha_fin < data.fecha_inicio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La fecha de fin no puede ser anterior a la de inicio",
          path: ["fecha_fin"],
        })
      }
    }
    if (data.fecha_inicio && !data.fecha_fin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe seleccionar una fecha de fin",
        path: ["fecha_fin"],
      })
    }
    if (data.fecha_fin && !data.fecha_inicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe seleccionar una fecha de inicio",
        path: ["fecha_inicio"],
      })
    }
  })
  .refine(
    (data) => {
      if (data.institucion_id === -1 && !data.nueva_institucion_nombre?.trim()) {
        return false
      }
      return true
    },
    { message: "Debe escribir el nombre de la nueva institución", path: ["nueva_institucion_nombre"] },
  )
  .refine(
    (data) => {
      if (data.capacitacion_id === -1 && !data.nueva_capacitacion_nombre?.trim()) {
        return false
      }
      return true
    },
    { message: "Debe escribir el nombre de la nueva capacitación", path: ["nueva_capacitacion_nombre"] },
  )
  .refine(
    (data) => {
      if (data.capacitacion_id != null && data.capacitacion_id > 0) {
        const hasInstitucion = data.institucion_id != null && data.institucion_id > 0
        const hasNewInstitucion = data.institucion_id === -1 && data.nueva_institucion_nombre?.trim()
        if (!hasInstitucion && !hasNewInstitucion) {
          return false
        }
      }
      return true
    },
    { message: "Debe seleccionar una institución", path: ["institucion_id"] },
  )

export const schemaSupplementaryTraining = z.object({
  formacion_complementaria: z.array(schemaFormacionComplementaria).optional(),
})
export type SupplementaryTrainingType = z.infer<
  typeof schemaSupplementaryTraining
>
