import { z } from "zod";
import { ERROR, REGEX } from "@/shared/domain/validation";
import { serialCarnetPatriaZod } from "@/shared/domain/validation/serial-carnet-patria";
import { telefonoZod } from "@/shared/domain/validation/telefono";

/** Listado de pasivos por búsqueda (zero-trust R7). */
export const listadoPasivosSchema = z.object({
  busqueda: z.string().trim().max(100, { message: "Búsqueda demasiado larga" }).optional(),
});

/** Cédula de trabajador pasivo (zero-trust R7). */
export const pasivoCedulaSchema = z.object({
  cedula: z.string().trim().regex(REGEX.CEDULA_DIGITOS, { message: "Cédula inválida" }),
});

/** Transición activo → pasivo (zero-trust R7). */
export const procesarEgresoSchema = z.object({
  cedula: z.string().trim().regex(REGEX.CEDULA_DIGITOS, { message: "Cédula inválida" }),
  motivoMovimientoId: z.number().int().positive({ message: ERROR.REQUIRED }),
  tipoNominaId: z.number().int().positive({ message: ERROR.REQUIRED }),
  liberarActivos: z.boolean().default(true),
  fechaEgreso: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Fecha de egreso inválida" })
    .optional()
    .or(z.literal("")),
});

export type ListadoPasivosFormType = z.infer<typeof listadoPasivosSchema>;
export type PasivoCedulaFormType = z.infer<typeof pasivoCedulaSchema>;
export type ProcesarEgresoFormType = z.infer<typeof procesarEgresoSchema>;

/** Filtros del listado paginado (servidor 10/50). */
export const filtrosPasivosSchema = z.object({
  cedula: z.string().trim().max(20).optional(),
  codigo: z.string().trim().max(50).optional(),
  tipoNominaId: z.number().int().positive().optional(),
  fechaDesde: z.string().trim().optional(),
  fechaHasta: z.string().trim().optional(),
  limit: z.number().int().min(1).max(50).default(10),
  offset: z.number().int().min(0).default(0),
});

/** Teléfonos opcionales con código de país (D-13): el móvil debe ser móvil; la habitación puede ser fija. */
const telefonoMovilOpcional = telefonoZod({ tipo: "movil" });
const telefonoHabitacionOpcional = telefonoZod({ tipo: "cualquiera" });

/** Alta directa de jubilado/pensionado (permiso pasivos.crear). */
export const registrarPasivoSchema = z.object({
  cedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_NUM, { message: "La cédula solo admite números (5 a 10 dígitos)" }),
  nombres: z
    .string()
    .trim()
    .min(1, { message: "Nombres requeridos" })
    .max(100)
    .regex(REGEX.NAME, { message: "Los nombres solo admiten letras y espacios" }),
  apellidos: z
    .string()
    .trim()
    .min(1, { message: "Apellidos requeridos" })
    .max(100)
    .regex(REGEX.NAME, { message: "Los apellidos solo admiten letras y espacios" }),
  sexoId: z.number().int().positive({ message: "Seleccione el sexo" }),
  fechaNacimiento: z.string().trim().min(1, { message: "Fecha de nacimiento requerida" }),
  tipoNominaId: z.number().int().positive({ message: "Seleccione una nómina de pasivo" }),
  estadoCivilId: z.number().int().positive().nullable().optional(),
  nacionalidadId: z.number().int().positive().nullable().optional(),
  correo: z.string().trim().email({ message: "Correo inválido" }).max(254).nullable().optional(),
  telefonoMovil: telefonoMovilOpcional,
  telefonoHabitacion: telefonoHabitacionOpcional,
  carnetPatria: z.string().trim().max(30).nullable().optional(),
  carnetPatriaSerial: serialCarnetPatriaZod(),
  datosVivienda: z
    .object({
      estado: z.number().int().positive().nullable().optional(),
      municipio: z.number().int().positive().nullable().optional(),
      parroquia: z.number().int().positive().nullable().optional(),
      direccion_exacta: z.string().trim().max(255).nullable().optional(),
    })
    .optional(),
});

/** Datos básicos editables del pasivo (permiso pasivos.editar). */
export const actualizarPasivoSchema = z.object({
  nombres: z
    .string()
    .trim()
    .min(2, { message: "Mínimo 2 caracteres" })
    .max(150, { message: "Máximo 150 caracteres" })
    .regex(REGEX.NAME_EDICION, { message: "Los nombres solo admiten letras y espacios" })
    .optional(),
  apellidos: z
    .string()
    .trim()
    .min(2, { message: "Mínimo 2 caracteres" })
    .max(150, { message: "Máximo 150 caracteres" })
    .regex(REGEX.NAME_EDICION, { message: "Los apellidos solo admiten letras y espacios" })
    .optional(),
  correo: z.string().trim().email({ message: "Correo inválido" }).max(254).nullable().optional(),
  telefonoMovil: telefonoMovilOpcional,
  telefonoHabitacion: telefonoHabitacionOpcional,
  carnetPatria: z.string().trim().max(30).nullable().optional(),
  carnetPatriaSerial: serialCarnetPatriaZod(),
  fechaNacimiento: z.string().trim().nullable().optional(),
  estadoCivilId: z.number().int().positive().nullable().optional(),
  nacionalidadId: z.number().int().positive().nullable().optional(),
});

export type FiltrosPasivosFormType = z.infer<typeof filtrosPasivosSchema>;
export type ActualizarPasivoFormType = z.infer<typeof actualizarPasivoSchema>;
export type RegistrarPasivoFormType = z.infer<typeof registrarPasivoSchema>;
