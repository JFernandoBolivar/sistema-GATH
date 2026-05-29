import { z } from "zod";

export const schemaReportLeaving = z.object({
  categoria: z.string().optional(),
  agrupar_por: z.string().optional(),
  tipo_reporte: z.string().optional(),
  filtros: z
    .object({
      dependencia_id: z.number().optional(),
      direccion_general_id: z.number().optional(),
      direccion_linea_id: z.number().or(z.null()).optional(),
      coordinacion_id: z.number().or(z.null()).optional(),
      sexo_id: z.number().optional(),
      discapacidad_id: z.number().optional(),
      grupo_sanguineo_id: z.number().optional(),
      patologia_id: z.number().optional(),
      nomina_id: z.number().optional(),
      grado_id: z.number().optional(),
      cargo_id: z.number().optional(),
      cargo_especifico_id: z.number().optional(),
      nivel_academico_id: z.number().optional(),
      carrera_id: z.number().optional(),
      mencion_id: z.number().optional(),
      apn_min: z
        .string()

        .transform((val) => (val ? parseInt(val, 10) : undefined))
        .pipe(z.number())
        .optional(),
      apn_max: z
        .string()

        .transform((val) => (val ? parseInt(val, 10) : undefined))
        .pipe(z.number())
        .optional(),
      edad_min: z
        .string()

        .transform((val) => (val ? parseInt(val, 10) : undefined))
        .pipe(z.number())
        .optional(),
      edad_max: z
        .string()

        .transform((val) => (val ? parseInt(val, 10) : undefined))
        .pipe(z.number())
        .optional(),
      fecha_ingreso_Desde: z.date().optional(),
      fecha_ingreso_Hasta: z.date().optional(),
      fecha_apn_Desde: z.date().optional(),
      fecha_apn_Hasta: z.date().optional(),
      region_id: z.number().optional(),
      estado_id: z.number().optional(),
      municipio_id: z.number().optional(),
      parroquia_id: z.number().optional(),
      condicion_vivienda_id: z.number().optional(),
    })
    .optional(),
});
export type SchemaReportLeavingType = z.infer<typeof schemaReportLeaving>;
