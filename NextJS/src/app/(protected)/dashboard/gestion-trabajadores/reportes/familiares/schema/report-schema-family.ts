import { z } from "zod";

export const schemaReportFamily = z.object({
  categoria: z.string().optional(),
  agrupar_por: z.string().optional(),
  tipo_reporte: z.string().optional(),
  filtros: z
    .object({
      region_id: z.number().optional(),
      condicion_vivienda_id: z.number().optional(),
      parroquia_id: z.number().optional(),
      municipio_id: z.number().optional(),
      estado_id: z.number().optional(),
      nivel_academico_id: z.number().optional(),
      parentesco_id: z.number().optional(),
      patologias_id: z.number().optional(),
      grupo_sanguineo_id: z.number().optional(),
      discapacidades_id: z.number().optional(),
      sexo_familiar_id: z.number().optional(),
      estado_civil_id: z.number().optional(),
      sexo_empleado_id: z.number().optional(),
      edad_empleado_min: z
        .string()
        .transform((val) => (val ? parseInt(val, 10) : undefined))
        .pipe(z.number())
        .optional(),
      edad_empleado_max: z
        .string()
        .transform((val) => (val ? parseInt(val, 10) : undefined))
        .pipe(z.number())
        .optional(),
      edad_familiar_min: z
        .string()
        .transform((val) => (val ? parseInt(val, 10) : undefined))
        .pipe(z.number())
        .optional(),
      edad_familiar_max: z
        .string()
        .transform((val) => (val ? parseInt(val, 10) : undefined))
        .pipe(z.number())
        .optional(),
      nomina_id: z.number().optional(),
      direccion_general_id: z.number().optional(),
      dependencia_id: z.number().optional(),
      direccion_linea_id: z.number().or(z.null()).optional(),
      coordinacion_id: z.number().or(z.null()).optional(),
    })
    .optional(),
});
export type SchemaReportFamilyType = z.infer<typeof schemaReportFamily>;
