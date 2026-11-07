import { z } from "zod";
import { REGEX } from "@/shared/domain/validation";
import { serialCarnetPatriaZod } from "@/shared/domain/validation/serial-carnet-patria";
import { telefonoZod } from "@/shared/domain/validation/telefono";
import { CORREO_MAX, DIRECCION_MAX, DIRECCION_MIN, cedulaZod, nombreZod } from "./reglas-personas";

/**
 * Helpers para campos anidados: toleran el string vacío/NaN que deja
 * react-hook-form y lo convierten a `null`, para que los bloques del
 * expediente puedan guardarse parcialmente.
 */
const aNull = (v: unknown) =>
  v === "" || v === null || v === undefined || (typeof v === "number" && Number.isNaN(v))
    ? null
    : v;

const numId = z.preprocess(aNull, z.number().int().positive().nullable());
const texto = z.preprocess(aNull, z.string().nullable());

function listaNumeros() {
  return z.preprocess(
    (v) =>
      Array.isArray(v) ? v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0) : [],
    z.array(z.number().int()),
  );
}

export const datosViviendaSchema = z.object({
  estadoId: numId.optional(),
  municipioId: numId.optional(),
  parroquiaId: numId.optional(),
  direccionExacta: z.preprocess(aNull, z.string().max(DIRECCION_MAX, { message: `La dirección admite máximo ${DIRECCION_MAX} caracteres` }).refine((v) => v.trim().length === 0 || v.trim().length >= DIRECCION_MIN, { message: `La dirección debe tener al menos ${DIRECCION_MIN} caracteres` }).nullable()).optional(),
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
    .max(10, { message: "Cédula admite máximo 10 dígitos" })
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula solo debe contener dígitos" }),
  // Edición: se tolera el punto de las iniciales del legado ("JOSE A.").
  nombres: z
    .string()
    .trim()
    .min(2, { message: "Nombres debe tener al menos 2 caracteres" })
    .max(60, { message: "Nombres admite máximo 60 caracteres" })
    .regex(REGEX.NAME_EDICION, { message: "Nombres solo debe contener letras" }),
  apellidos: z
    .string()
    .trim()
    .min(2, { message: "Apellidos debe tener al menos 2 caracteres" })
    .max(60, { message: "Apellidos admite máximo 60 caracteres" })
    .regex(REGEX.NAME_EDICION, { message: "Apellidos solo debe contener letras" }),
  sexoId: z.number().positive({ message: "Seleccione un sexo válido" }),
  fechaNacimiento: z
    .string()
    .regex(REGEX.FECHA_ISO, { message: "Formato de fecha inválido (YYYY-MM-DD)" }),
  correo: z
    .string()
    .trim()
    .max(CORREO_MAX, { message: `Correo admite máximo ${CORREO_MAX} caracteres` })
    .email({ message: "Correo inválido" })
    .optional()
    .nullable(),
  correoAlternativo: z
    .string()
    .trim()
    .max(CORREO_MAX, { message: `Correo admite máximo ${CORREO_MAX} caracteres` })
    .email({ message: "Correo alternativo inválido" })
    .optional()
    .nullable()
    .or(z.literal("")),
  telefonoMovil: telefonoZod({ tipo: "movil" }),
  telefonoHabitacion: telefonoZod({ tipo: "cualquiera" }),
  estadoCivilId: z.number().positive().optional().nullable(),
  nacionalidadId: z.number().int().positive().optional().nullable(),
  carnetPatria: z
    .string()
    .trim()
    .regex(/^\d{10}$/, { message: "El código del Carnet de la Patria debe tener 10 dígitos" })
    .optional()
    .nullable()
    .or(z.literal("")),
  carnetPatriaSerial: serialCarnetPatriaZod(),
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

/**
 * Revalidación zero-trust del ALTA (`registrarEmpleadoAction`) con las reglas
 * de negocio del legado (`shared/schemas/employees/register/*`), las mismas
 * que aplica el wizard por paso: cédula 6-9 dígitos, nombres/apellidos 2-60
 * letras, nacimiento no futuro y edad mínima 16, carnet de la patria de 10
 * dígitos, estado civil, vivienda completa y tallas de camisa/pantalón/zapatos
 * obligatorias. La edición (`empleadoSchema.partial()`) conserva las reglas
 * laxas para no rechazar expedientes históricos.
 */
const idRequerido = (mensaje: string) =>
  z.number({ message: mensaje }).int().positive({ message: mensaje });

function edadEnAnios(fechaIso: string) {
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  const hoy = new Date();
  let edad = hoy.getFullYear() - anio;
  if (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia)) edad -= 1;
  return edad;
}

export const empleadoRegistroSchema = empleadoSchema.extend({
  cedula: cedulaZod(),
  nombres: nombreZod("El nombre"),
  apellidos: nombreZod("El apellido"),
  fechaNacimiento: z
    .string()
    .regex(REGEX.FECHA_ISO, { message: "Formato de fecha inválido (YYYY-MM-DD)" })
    .refine((f) => edadEnAnios(f) >= 0, {
      message: "La Fecha De Nacimiento No Puede Ser En El Futuro",
    })
    .refine((f) => edadEnAnios(f) >= 16, { message: "La Edad Mínima Es De 16 Años" }),
  estadoCivilId: idRequerido("Debe Seleccionar Un Estado Civil"),
  nacionalidadId: idRequerido("Debe Seleccionar Una Nacionalidad"),
  carnetPatria: z
    .string()
    .trim()
    .regex(/^\d{10}$/, { message: "El código del Carnet de la Patria debe tener 10 dígitos" })
    .optional()
    .nullable(),
  carnetPatriaSerial: serialCarnetPatriaZod(),
  datosVivienda: z.object({
    estadoId: idRequerido("Debe Seleccionar Un Estado"),
    municipioId: idRequerido("Debe Seleccionar Un Municipio"),
    parroquiaId: idRequerido("Debe Seleccionar Una Parroquia"),
    direccionExacta: z
      .string()
      .trim()
      .min(DIRECCION_MIN, { message: `La dirección debe tener al menos ${DIRECCION_MIN} caracteres` })
      .max(DIRECCION_MAX, { message: `La dirección admite máximo ${DIRECCION_MAX} caracteres` }),
    condicionViviendaId: idRequerido("Debe Seleccionar Una Condicion De Vivienda"),
    codigoPostalId: idRequerido("Seleccione un código postal"),
  }),
  perfilFisico: perfilFisicoSchema.extend({
    tallaCamisaId: idRequerido("Debe seleccionar una talla de camisa"),
    tallaPantalonId: idRequerido("Debe seleccionar una talla de pantalón"),
    tallaZapatosId: idRequerido("Debe seleccionar una talla de zapatos"),
  }),
});

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
  cedula: z.string().trim().regex(REGEX.CEDULA_DIGITOS, { message: "Cédula inválida" }),
});

/** Correo opcional del formulario (vacío permitido; máximo 254). */
const correoFormulario = (mensaje: string) =>
  z
    .string()
    .trim()
    .max(CORREO_MAX, { message: `El correo admite máximo ${CORREO_MAX} caracteres` })
    .refine((v) => v === "" || REGEX.EMAIL.test(v), { message: mensaje });

/**
 * Formulario «Actualizar Información Básica». `carnetPatriaOriginal` es el valor
 * que ya tenía el trabajador: el código solo se exige de 10 dígitos si se cambia
 * (hay expedientes del legado con otro formato).
 */
export function empleadoBasicoFormSchema(carnetPatriaOriginal = "") {
  return z
    .object({
    nombres: empleadoSchema.shape.nombres,
    apellidos: empleadoSchema.shape.apellidos,
    fechaNacimiento: z.string().min(1, { message: "La fecha de nacimiento es obligatoria" }),
    sexoId: z.coerce.number({ message: "Seleccione el sexo" }).positive({ message: "Seleccione el sexo" }),
    nacionalidadId: z.coerce
      .number({ message: "Seleccione la nacionalidad" })
      .positive({ message: "Seleccione la nacionalidad" }),
    estadoCivilId: z.coerce.number().optional(),
    correo: correoFormulario("Correo institucional inválido"),
    correoAlternativo: correoFormulario("Correo alternativo inválido"),
    telefonoMovil: telefonoZod({ tipo: "movil" }),
    telefonoHabitacion: telefonoZod({ tipo: "cualquiera" }),
    carnetPatria: z
      .string()
      .trim()
      .max(30)
      .refine((v) => v === "" || v === carnetPatriaOriginal || /^\d{10}$/.test(v), {
        message: "El código del Carnet de la Patria debe tener 10 dígitos",
      }),
    carnetPatriaSerial: serialCarnetPatriaZod(),
    })
    .refine(
      (d) => {
        const institucional = d.correo?.trim().toLowerCase();
        const alternativo = d.correoAlternativo?.trim().toLowerCase();
        return !institucional || !alternativo || institucional !== alternativo;
      },
      {
        message: "El correo alternativo debe ser distinto del institucional",
        path: ["correoAlternativo"],
      },
    );
}
export type EmpleadoBasicoFormValues = z.input<ReturnType<typeof empleadoBasicoFormSchema>>;
