import { z } from "zod";
import { ERROR, REGEX } from "@/shared/domain/validation";

/**
 * Helpers para campos anidados: toleran el string vacío/NaN que deja
 * react-hook-form y lo convierten a `null`, para que los bloques del
 * expediente puedan guardarse parcialmente.
 */
const aNull = (v: unknown) =>
  v === "" || v === null || v === undefined || (typeof v === "number" && Number.isNaN(v)) ? null : v;

const numId = z.preprocess(aNull, z.number().int().positive().nullable());
const texto = z.preprocess(aNull, z.string().nullable());

function listaNumeros() {
  return z.preprocess(
    (v) =>
      Array.isArray(v)
        ? v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
        : [],
    z.array(z.number().int()),
  );
}

export const datosViviendaSchema = z.object({
  estadoId: numId.optional(),
  municipioId: numId.optional(),
  parroquiaId: numId.optional(),
  direccionExacta: texto.optional(),
  condicionViviendaId: numId.optional(),
  codigoPostalId: numId.optional(),
});

export const perfilSaludSchema = z.object({
  grupoSanguineoId: numId.optional(),
  alergias: listaNumeros().optional(),
  patologiasCronicas: listaNumeros().optional(),
  discapacidades: listaNumeros().optional(),
});

export const perfilFisicoSchema = z.object({
  tallaCamisaId: numId.optional(),
  tallaPantalonId: numId.optional(),
  tallaZapatosId: numId.optional(),
  tallaChaquetaId: numId.optional(),
});

export const formacionAcademicaItemSchema = z.object({
  nivelAcademicoId: numId.optional(),
  carreraId: numId.optional(),
  mencionId: numId.optional(),
  institucionId: numId.optional(),
});

export const formacionComplementariaItemSchema = z.object({
  capacitacionId: numId.optional(),
  institucionId: numId.optional(),
  fechaInicio: texto.optional(),
  fechaFin: texto.optional(),
  diasCompletados: texto.optional(),
  horasCompletadas: texto.optional(),
  procedenciaId: numId.optional(),
  grupoId: numId.optional(),
});

export const contactoEmergenciaItemSchema = z.object({
  nombres: texto.optional(),
  apellidos: texto.optional(),
  telefono: texto.optional(),
  relacionId: numId.optional(),
});

export const antecedenteItemSchema = z.object({
  organismoId: numId.optional(),
  fechaIngreso: texto.optional(),
  fechaEgreso: texto.optional(),
});

export const contratoItemSchema = z.object({
  nContrato: texto.optional(),
  fechaIngreso: texto.optional(),
  fechaCulminacion: texto.optional(),
  politicaId: numId.optional(),
});

export const empleadoSchema = z.object({
  cedula: z
    .string()
    .trim()
    .min(5, { message: "Cédula debe tener al menos 5 caracteres" })
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula solo debe contener dígitos" }),
  nombres: z
    .string()
    .trim()
    .min(2, { message: "Nombres debe tener al menos 2 caracteres" })
    .regex(REGEX.SOLO_LETRAS, { message: "Nombres solo debe contener letras" }),
  apellidos: z
    .string()
    .trim()
    .min(2, { message: "Apellidos debe tener al menos 2 caracteres" })
    .regex(REGEX.SOLO_LETRAS, { message: "Apellidos solo debe contener letras" }),
  sexoId: z.number().positive({ message: "Seleccione un sexo válido" }),
  fechaNacimiento: z
    .string()
    .regex(REGEX.FECHA_ISO, { message: "Formato de fecha inválido (YYYY-MM-DD)" }),
  correo: z
    .string()
    .trim()
    .email({ message: "Correo inválido" })
    .optional()
    .nullable(),
  telefonoMovil: z
    .string()
    .trim()
    .regex(REGEX.TELEFONO, { message: "Teléfono inválido (ej: 04121234567)" })
    .optional()
    .nullable(),
  telefonoHabitacion: z.string().trim().optional().nullable(),
  estadoCivilId: z.number().positive().optional().nullable(),
  carnetPatria: z.string().trim().optional().nullable(),
  datosVivienda: datosViviendaSchema.optional(),
  perfilSalud: perfilSaludSchema.optional(),
  perfilFisico: perfilFisicoSchema.optional(),
  formacionAcademica: z.array(formacionAcademicaItemSchema).optional(),
  formacionComplementaria: z.array(formacionComplementariaItemSchema).optional(),
  contactoEmergencia: z.array(contactoEmergenciaItemSchema).optional(),
  antecedentes: z.array(antecedenteItemSchema).optional(),
  contrato: z.array(contratoItemSchema).optional(),
});

export type EmpleadoFormType = z.infer<typeof empleadoSchema>;

/** Filtro de listado de empleados (zero-trust R7). */
export const listadoEmpleadosSchema = z.object({
  busqueda: z.string().trim().max(100, { message: "Búsqueda demasiado larga" }).optional(),
  cedulaidentidad: z.string().trim().max(100).optional(),
  codigo: z.string().trim().max(100).optional(),
  tipo_nomina: z.union([z.string(), z.number()]).optional(),
});
export type ListadoEmpleadosFormType = z.infer<typeof listadoEmpleadosSchema>;

/** Cédula de empleado (zero-trust R7). */
export const empleadoCedulaSchema = z.object({
  cedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula inválida" }),
});
