import z from "zod";

export const schemaFamilyEmployee = z.object({
  cedulaFamiliar: z
    .string()
    .refine((val) => /^\d+$/.test(val), {
      message: "La Cédula No Puede Contener Letras",
    })
    .optional(),
  primer_nombre: z
    .string()
    .refine((v) => /^[A-Za-zÁÉÍÓÚáéíóúñÑ\s]+$/.test(v), {
      message: "No Debe Ingresar Numeros",
    })
    .optional(),
  segundo_nombre: z
    .string()
    .refine((v) => !v || /^[A-Za-zÁÉÍÓÚáéíóúñÑ\s]+$/.test(v), {
      message: "No Debe Ingresar Numeros",
    })
    .optional(),
  primer_apellido: z
    .string()
    .refine((v) => /^[A-Za-zÁÉÍÓÚáéíóúñÑ\s]+$/.test(v), {
      message: "No Debe Ingresar Numeros",
    })
    .optional(),
  segundo_apellido: z
    .string()
    .refine((v) => !v || /^[A-Za-zÁÉÍÓÚáéíóúñÑ\s]+$/.test(v), {
      message: "No Debe Ingresar Numeros",
    })
    .optional(),
  parentesco: z.number().optional(),
  fechanacimiento: z
    .date({
      invalid_type_error: "Formato de fecha inválido",
    })
    .optional(),
  sexo: z.number().optional(),
  estadoCivil: z.number().optional(),
  observaciones: z.string().optional(),
  mismo_ente: z.boolean().optional(),
  heredero: z.boolean().optional(),
  perfil_salud_familiar: z
    .object({
      grupoSanguineo: z
        .number({
          message: "Debe seleccionar un grupo sanguíneo",
        })
        .optional(),
      patologiaCronica: z.array(z.number()).optional(),
      alergias: z.array(z.number()).optional(),
      discapacidad: z.array(z.number()).optional(),
    })
    .optional(),
  perfil_fisico_familiar: z
    .object({
      tallaCamisa: z
        .number({
          message: "Debe seleccionar una talla de camisa",
        })
        .optional(),
      tallaPantalon: z
        .number({
          message: "Debe seleccionar una talla de pantalón",
        })
        .optional(),
      tallaZapatos: z
        .number({
          message: "Debe seleccionar una talla de zapatos",
        })
        .optional(),
      tallaChaqueta: z
        .number({
          message: "Debe seleccionar una talla de chaqueta",
        })
        .optional(),
    })
    .optional(),
  formacion_academica_familiar: z
    .object({
      nivel_Academico_id: z.number().optional(),
      carrera_id: z.number().optional(),
      mencion_id: z.number().optional(),
      capacitacion: z.string().optional(),
      institucion: z.string().optional(),
    })
    .optional(),
  orden_hijo: z.number().optional(),
});

export const schemaFamilyFormity = z.object({
  familys: z.array(schemaFamilyEmployee).optional(),
});
export type FamilyEmployeeType = z.infer<typeof schemaFamilyFormity>;
