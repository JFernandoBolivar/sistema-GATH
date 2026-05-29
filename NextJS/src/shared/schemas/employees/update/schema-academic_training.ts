import { z } from "zod"

export const schemaAcademyUpdateItem = z.object({
  nivel_Academico_id: z
    .number({
      message: "Debe Seleccionar un Nivel Academico",
    })
    .optional()
    .nullable(),
  carrera_id: z
    .number({
      message: "Debe Ingresar Información Valida",
    })
    .optional()
    .nullable(),
  nueva_carrera_nombre: z.string().optional(),
  mencion_id: z
    .number({
      message: "Debe Ingresar Información Valida",
    })
    .optional()
    .nullable(),
  nueva_mencion_nombre: z.string().optional(),
  institucion_id: z
    .number({
      message: "Debe seleccionar una institución",
    })
    .optional()
    .nullable(),
  nueva_institucion_nombre: z.string().optional(),
})
.refine(
  (data) => {
    if (data.carrera_id === -1 && !data.nueva_carrera_nombre?.trim()) {
      return false
    }
    return true
  },
  { message: "Debe escribir el nombre de la nueva carrera", path: ["nueva_carrera_nombre"] },
)
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
    if (data.mencion_id === -1 && !data.nueva_mencion_nombre?.trim()) {
      return false
    }
    return true
  },
  { message: "Debe escribir el nombre de la nueva mención", path: ["nueva_mencion_nombre"] },
)
.refine(
  (data) => {
    if (data.carrera_id != null && data.carrera_id !== -1 && data.carrera_id > 0) {
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

export const schemaAcademyUpdate = z.object({
  formacion_academica: z.array(schemaAcademyUpdateItem).optional(),
})
export type AcademyUpdateUpdateType = z.infer<typeof schemaAcademyUpdate>
