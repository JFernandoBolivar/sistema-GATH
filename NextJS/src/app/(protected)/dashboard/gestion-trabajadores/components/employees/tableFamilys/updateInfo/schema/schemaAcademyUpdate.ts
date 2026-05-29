import z from "zod";

export const schemaUpdateAcademy = z.object({
  formacion_academica_familiar: z.object({
    nivel_Academico_id: z.coerce.number().optional(),
    carrera_id: z.coerce.number().optional(),
    nueva_carrera_nombre: z.string().optional(),
    mencion_id: z.coerce.number().optional(),
    nueva_mencion_nombre: z.string().optional(),
    institucion_id: z.coerce.number().optional(),
    nueva_institucion_nombre: z.string().optional(),
    capacitacion: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.carrera_id === -1 && !data.nueva_carrera_nombre?.trim()) {
        return false;
      }
      return true;
    },
    { message: "Debe escribir el nombre de la nueva carrera", path: ["nueva_carrera_nombre"] },
  )
  .refine(
    (data) => {
      if (data.mencion_id === -1 && !data.nueva_mencion_nombre?.trim()) {
        return false;
      }
      return true;
    },
    { message: "Debe escribir el nombre de la nueva mención", path: ["nueva_mencion_nombre"] },
  )
  .refine(
    (data) => {
      if (data.institucion_id === -1 && !data.nueva_institucion_nombre?.trim()) {
        return false;
      }
      return true;
    },
    { message: "Debe escribir el nombre de la nueva institución", path: ["nueva_institucion_nombre"] },
  ),
});

export type TypeSchemaUpdateAcademy = z.infer<typeof schemaUpdateAcademy>;
