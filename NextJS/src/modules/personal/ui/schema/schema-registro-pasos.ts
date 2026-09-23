import { z } from "zod";
import { REGEX } from "@/shared/domain/validation";

/**
 * Schemas Zod por paso del wizard de registro (`/personal/registrar`), con los
 * mismos campos, reglas y mensajes que el legado
 * (`shared/schemas/employees/register/*`). El resultado combinado se mapea a
 * `GuardarEmpleadoInputDTO` con `registroPasosADTO` y la Server Action lo
 * revalida con `empleadoSchema` (contrato del servidor intacto).
 *
 * Diferencia deliberada: no existe la opción "Otra" (alta de carrera,
 * mención, institución, capacitación u organismo al vuelo) porque el backend
 * nuevo no expone esas altas desde el expediente.
 */

const opcionalVacio = (v: unknown) => (v === "" ? undefined : v);

// --- Paso 1: Información básica -------------------------------------------
export const pasoBasicInfoSchema = z.object({
  cedulaidentidad: z
    .string({ required_error: "Cédula De Identidad Es Requerido" })
    .regex(REGEX.DIGITS, { message: "Solo Se Permiten Números" })
    .min(7, { message: "Debe Ingresar Al Menos 7 Digitos" })
    .max(12, { message: "Debe Maximo 12 Digitos" }),
  nombres: z
    .string({ message: "Debe Ingresar Letras", required_error: "El Nombre Completo Es Requerido" })
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, { message: "Solo Se Permiten Letras" })
    .min(3, { message: "Debe Ingresar Al Menos 3 Letras" })
    .max(30, { message: "Debe Ingresar Maximo 30 Letras" }),
  apellidos: z
    .string({ message: "Debe Ingresar Letras", required_error: "El Apellido Completo Es Requerido" })
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, { message: "Solo Se Permiten Letras" })
    .min(3, { message: "Debe Ingresar Al Menos 3 Letras" })
    .max(30, { message: "Debe Ingresar Maximo 30 Letras" }),
  file: z
    .custom<File | null>((v) => v === null || v === undefined || (typeof File !== "undefined" && v instanceof File))
    .nullable()
    .optional()
    .refine((file) => !file || file.size <= 5000000, { message: "El Tamaño Maximo De La Imagen Es 5MB" }),
  fecha_nacimiento: z
    .date({ message: "Debe Ingresar Una Fecha Requerida", required_error: "La Fecha Es Requerida" })
    .refine((date) => date <= new Date(), { message: "La Fecha De Nacimiento No Puede Ser En El Futuro" })
    .refine((date) => new Date().getFullYear() - date.getFullYear() >= 16, { message: "La Edad Mínima Es De 16 Años" }),
  sexoid: z.coerce
    .number({ message: "Debe Ingresar Un Sexo Valido", required_error: "El Sexo Es Requerido" })
    .refine((val) => val !== 0, { message: "Debe Seleccionar Un Sexo" }),
  estadoCivil: z
    .number({ message: "Debe Ingresar Un Estado Civil Valido" })
    .refine((val) => val !== 0, { message: "Debe Seleccionar Un Esttado Civil" }),
  correo: z.preprocess(
    opcionalVacio,
    z.string().regex(REGEX.EMAIL, { message: "Solo Se Permiten Correos" }).optional(),
  ),
  telefono_habitacion: z.preprocess(
    opcionalVacio,
    z
      .string()
      .regex(REGEX.PHONE_VE_FIJO, { message: "Número inválido. Debe iniciar con un prefijo válido y tener 11 dígitos en total" })
      .optional(),
  ),
  telefono_movil: z.preprocess(
    opcionalVacio,
    z
      .string()
      .regex(REGEX.PHONE_VE, { message: "Número inválido. Debe iniciar con un prefijo válido y tener 11 dígitos en total" })
      .optional(),
  ),
  carnet_patria: z.preprocess(
    opcionalVacio,
    z
      .string()
      .regex(REGEX.DIGITS, { message: "Solo Se Permiten Números" })
      .min(10, { message: "Debe Ingresar 10 Digitos" })
      .max(10, { message: "Debe Maximo 10 Digitos" })
      .optional(),
  ),
});
export type PasoBasicInfoType = z.infer<typeof pasoBasicInfoSchema>;

// --- Paso 2: Formación académica ------------------------------------------
export const formacionAcademicaPasoItemSchema = z
  .object({
    nivel_Academico_id: z
      .number({ message: "Debe Seleccionar un Nivel Academico", required_error: "Este Campo Es Requerido" })
      .min(1, { message: "Debe Seleccionar un Nivel Academico" }),
    carrera_id: z.number({ message: "Debe Ingresar Información Valida" }).optional(),
    mencion_id: z.number({ message: "Debe Ingresar Información Valida" }).optional(),
    institucion_id: z.number({ message: "Debe seleccionar una institución" }).optional(),
  })
  .refine(
    (d) => !(d.carrera_id != null && d.carrera_id > 0) || (d.institucion_id != null && d.institucion_id > 0),
    { message: "Debe seleccionar una institución", path: ["institucion_id"] },
  );
export const pasoAcademySchema = z.object({
  formacion_academica: z.array(formacionAcademicaPasoItemSchema).optional(),
});
export type PasoAcademyType = z.infer<typeof pasoAcademySchema>;

// --- Paso 3: Formación complementaria -------------------------------------
export const formacionComplementariaPasoItemSchema = z
  .object({
    capacitacion_id: z
      .number({ message: "Debe seleccionar una capacitación" })
      .refine((val) => val >= 1, { message: "Debe seleccionar una capacitación" }),
    institucion_id: z
      .number({ message: "Debe seleccionar una institución" })
      .refine((val) => val >= 1, { message: "Debe seleccionar una institución" }),
    procedencia_id: z
      .number({ message: "Debe seleccionar una procedencia" })
      .min(1, { message: "Debe seleccionar una procedencia" }),
    horas_completadas: z.string().optional(),
    grupo_id: z.number().optional(),
    fecha_inicio: z.date({ message: "Debe Ingresar Información Valida" }).optional(),
    fecha_fin: z.date({ message: "Debe Ingresar Información Valida" }).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.fecha_inicio && d.fecha_fin && d.fecha_fin < d.fecha_inicio) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La fecha de fin no puede ser anterior a la de inicio", path: ["fecha_fin"] });
    }
    if (d.fecha_inicio && !d.fecha_fin) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe seleccionar una fecha de fin", path: ["fecha_fin"] });
    }
    if (d.fecha_fin && !d.fecha_inicio) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe seleccionar una fecha de inicio", path: ["fecha_inicio"] });
    }
  });
export const pasoSupplementaryTrainingSchema = z.object({
  formacion_complementaria: z.array(formacionComplementariaPasoItemSchema).optional(),
});
export type PasoSupplementaryTrainingType = z.infer<typeof pasoSupplementaryTrainingSchema>;

// --- Paso 4: Antecedentes en la Administración Pública --------------------
export const antecedentePasoItemSchema = z
  .object({
    fecha_ingreso: z.date().optional(),
    fecha_egreso: z.date().optional(),
    organismo_id: z.number({ message: "Seleccione un organismo" }).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.fecha_ingreso && d.fecha_egreso) {
      if (d.fecha_egreso <= d.fecha_ingreso) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La Fecha De Egreso No Puede Ser Anterior A La Fecha De Ingreso", path: ["fecha_egreso"] });
      }
      if (d.organismo_id === undefined || d.organismo_id === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe seleccionar un organismo", path: ["organismo_id"] });
      }
    }
    if (d.fecha_ingreso && !d.fecha_egreso) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe Seleccionar Una Fecha De Egreso", path: ["fecha_egreso"] });
    }
    if (d.fecha_egreso && !d.fecha_ingreso) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe Seleccionar Una Fecha De Ingreso", path: ["fecha_ingreso"] });
    }
  });
export const pasoBackgroundSchema = z.object({
  antecedentes: z.array(antecedentePasoItemSchema).optional(),
});
export type PasoBackgroundType = z.infer<typeof pasoBackgroundSchema>;

// --- Paso 5: Perfil de salud ----------------------------------------------
export const pasoHealthSchema = z.object({
  perfil_salud: z.object({
    grupoSanguineo: z.number({ message: "Debe seleccionar un grupo sanguíneo" }).optional(),
    patologiaCronica: z.array(z.number()).optional(),
    alergias: z.array(z.number()).optional(),
    discapacidad: z.array(z.number()).optional(),
  }),
});
export type PasoHealthType = z.infer<typeof pasoHealthSchema>;

// --- Paso 6: Vestimenta ---------------------------------------------------
export const pasoPhysicalProfileSchema = z.object({
  perfil_fisico: z.object({
    tallaCamisa: z.number({ message: "Debe seleccionar una talla de camisa" }).min(1, "Debe seleccionar una talla de camisa"),
    tallaPantalon: z.number({ message: "Debe seleccionar una talla de pantalón" }).min(1, "Debe seleccionar una talla de pantalón"),
    tallaZapatos: z.number({ message: "Debe seleccionar una talla de zapatos" }).min(1, "Debe seleccionar una talla de zapatos"),
    tallaChaqueta: z.number({ message: "Debe seleccionar una talla de chaqueta" }).optional(),
  }),
});
export type PasoPhysicalProfileType = z.infer<typeof pasoPhysicalProfileSchema>;

// --- Paso 7: Vivienda -----------------------------------------------------
export const pasoDwellingSchema = z.object({
  datos_vivienda: z.object({
    direccion_exacta: z
      .string({ message: "Debe Ingresar Información Valida", required_error: "Este Campo Es Requerido" })
      .min(10, "La Direccion Exacta Debe Tener Minimo 10 Caracteres"),
    estado_id: z
      .number({ message: "Debe Ingresar Información Valida", required_error: "Este Campo Es Requerido" })
      .min(1, "Debe Seleccionar Un Estado"),
    municipio_id: z
      .number({ message: "Debe Ingresar Información Valida", required_error: "Este Campo Es Requerido" })
      .min(1, "Debe Seleccionar Un Municipio"),
    parroquia: z
      .number({ message: "Debe Ingresar Información Valida", required_error: "Este Campo Es Requerido" })
      .min(1, "Debe Seleccionar Una Parroquia"),
    condicion_vivienda_id: z
      .number({ message: "Debe Ingresar Información Valida", required_error: "Este Campo Es Requerido" })
      .min(1, "Debe Seleccionar Una Condicion De Vivienda"),
    codigo_postal_id: z.coerce.number().min(1, "Seleccione un código postal"),
  }),
});
export type PasoDwellingType = z.infer<typeof pasoDwellingSchema>;

export type RegistroPasosType = PasoBasicInfoType &
  PasoAcademyType &
  PasoSupplementaryTrainingType &
  PasoBackgroundType &
  PasoHealthType &
  PasoPhysicalProfileType &
  PasoDwellingType;
