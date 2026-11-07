import { LIMITES_TEXTO, textoLibreOpcional, textoLibreRequerido } from "@/shared/validation/limites-texto";
import { z } from "zod";
import {
  DATE_ISO,
  DATE_ISO_MSG,
  EMAIL,
  EMAIL_MSG,
  NAME,
  NAME_MSG,
  NO_HTML,
  NO_HTML_MSG,
} from "@/shared/validation";
import { telefonoZod } from "@/shared/domain/validation/telefono";
import { seccionDeCampo } from "../../domain/value-objects/campos-seccion";
import { errorDeMotivo } from "../../domain/services/validar-motivo";
import {
  PLAZO_MAX_DIAS,
  PLAZO_MIN_DIAS,
} from "../../application/use-cases/gestionar-solicitud-bienestar";

// Acepta la cédula real y la sintética que el servidor genera para un hijo(a) menor de 9
// años (`<cédula del titular>-<orden>`), que se conserva al editar ese familiar.
export const CEDULA_FAMILIAR = /^(?:[A-Za-z]?-?\d{5,9}|\d{5,9}-\d+)$/;
export const CEDULA_FAMILIAR_MSG = "Cédula inválida. Ejemplo: V-12345678";

const textoRequerido = (nombre: string, max = 150) =>
  z
    .string({ required_error: `${nombre} es obligatorio` })
    .trim()
    .min(1, `${nombre} es obligatorio`)
    .max(max, `${nombre} no puede superar ${max} caracteres`)
    .regex(NO_HTML, NO_HTML_MSG);

const textoOpcional = (max = 150) =>
  z
    .string()
    .trim()
    .max(max, `No puede superar ${max} caracteres`)
    .regex(NO_HTML, NO_HTML_MSG)
    .optional()
    .or(z.literal(""));

/** Teléfonos con código de país (D-13): el móvil debe ser móvil, la habitación puede ser fija. */
const telefonoMovilOpcional = telefonoZod({ tipo: "movil" }).transform((v) => v ?? "");
const telefonoHabitacionOpcional = telefonoZod({ tipo: "cualquiera" }).transform((v) => v ?? "");
const telefonoRequerido = telefonoZod({ requerido: true, tipo: "cualquiera" }).transform(
  (v) => v ?? "",
);

/** Nombres y apellidos: solo letras (con acentos), espacios y signos de nombre. */
const nombreRequerido = (nombre: string) =>
  z
    .string({ required_error: `${nombre} es obligatorio` })
    .trim()
    .min(1, `${nombre} es obligatorio`)
    .max(100, `${nombre} no puede superar 100 caracteres`)
    .regex(NAME, NAME_MSG);

const nombreOpcional = () =>
  z
    .string()
    .trim()
    .max(100, "No puede superar 100 caracteres")
    .regex(NAME, NAME_MSG)
    .optional()
    .or(z.literal(""));

/** Identificador de catálogo: las listas desplegables entregan texto; vacío = sin elegir. */
const idCatalogo = (nombre: string) =>
  z
    .union([z.number().int().positive(), z.string().regex(/^\d+$/, `Elija ${nombre}`)])
    .transform((v) => Number(v));
const idCatalogoOpcional = z
  .union([z.number().int().positive(), z.string().regex(/^\d*$/), z.null()])
  .optional()
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)));

// ── Solicitud ──
/** Motivo único: mínimo 5 palabras y 20 caracteres (igual que el servidor). */
const motivoSolicitud = z
  .string({ required_error: "El motivo es obligatorio" })
  .superRefine((valor, ctx) => {
    const error = errorDeMotivo(valor);
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
  })
  .transform((v) => v.trim())
  .refine((v) => NO_HTML.test(v), NO_HTML_MSG);

export const solicitudNuevaSchema = z.object({
  campos: z
    .array(z.string().refine((c) => seccionDeCampo(c) !== undefined, "Campo no autogestionable"))
    .min(1, "Elija al menos un campo para actualizar"),
  motivo: motivoSolicitud,
});
export type SolicitudNuevaValores = z.infer<typeof solicitudNuevaSchema>;

// ── Secciones del borrador ──
export const contactoSchema = z.object({
  telefono_movil: telefonoMovilOpcional,
  telefono_habitacion: telefonoHabitacionOpcional,
  correo_alternativo: z
    .string()
    .trim()
    .max(254, "El correo es demasiado largo")
    .regex(EMAIL, EMAIL_MSG)
    .optional()
    .or(z.literal("")),
});
export type ContactoValores = z.infer<typeof contactoSchema>;

export const contactoEmergenciaSchema = z.object({
  nombres: nombreRequerido("Los nombres"),
  apellidos: nombreRequerido("Los apellidos"),
  telefono: telefonoRequerido,
  relacion_id: idCatalogo("el parentesco o la relación"),
});
export type ContactoEmergenciaValores = z.infer<typeof contactoEmergenciaSchema>;

export const viviendaSchema = z.object({
  estado_id: idCatalogo("el estado"),
  municipio_id: idCatalogo("el municipio"),
  parroquia_id: idCatalogo("la parroquia"),
  direccion_exacta: textoLibreRequerido("La dirección", LIMITES_TEXTO.direccion),
  condicion_vivienda_id: idCatalogo("la condición de la vivienda"),
  codigo_postal_id: idCatalogo("el código postal"),
});
export type ViviendaValores = z.infer<typeof viviendaSchema>;

export const formacionSchema = z.object({
  nivel_academico_id: idCatalogo("el nivel académico"),
  carrera_id: idCatalogoOpcional,
  mencion_id: idCatalogoOpcional,
  institucion_id: idCatalogoOpcional,
});
export type FormacionValores = z.infer<typeof formacionSchema>;

export const complementariaSchema = z.object({
  capacitacion_id: idCatalogo("la capacitación"),
  institucion_id: idCatalogoOpcional,
  fecha_inicio: z.string().regex(DATE_ISO, DATE_ISO_MSG).optional().or(z.literal("")),
  fecha_fin: z.string().regex(DATE_ISO, DATE_ISO_MSG).optional().or(z.literal("")),
  horas_completadas: textoOpcional(20),
  dias_completados: textoOpcional(20),
  grupo_id: idCatalogoOpcional,
});
export type ComplementariaValores = z.infer<typeof complementariaSchema>;

export const familiarSchema = z.object({
  primer_nombre: nombreRequerido("El primer nombre"),
  segundo_nombre: nombreOpcional(),
  primer_apellido: nombreRequerido("El primer apellido"),
  segundo_apellido: nombreOpcional(),
  cedula_familiar: z
    .string()
    .trim()
    .regex(CEDULA_FAMILIAR, CEDULA_FAMILIAR_MSG)
    .optional()
    .or(z.literal("")),
  parentesco_id: idCatalogo("el parentesco"),
  orden_hijo: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .refine(
      (v) => v === undefined || v === null || v === "" || (Number(v) >= 1 && Number(v) <= 99),
      "El orden de nacimiento debe estar entre 1 y 99",
    ),
  fecha_nacimiento: z
    .string()
    .regex(DATE_ISO, DATE_ISO_MSG)
    .refine(
      (v) => new Date(v).getTime() <= Date.now(),
      "La fecha de nacimiento no puede ser futura",
    ),
  sexo_id: idCatalogo("el sexo"),
  observaciones: textoLibreOpcional("Las observaciones", LIMITES_TEXTO.observacion),
});
export type FamiliarValores = z.infer<typeof familiarSchema>;

// ── Identidad (D19/D21) ──
export const CEDULA_EMPLEADO = /^\d{5,9}$/;
export const CEDULA_EMPLEADO_MSG = "La cédula debe tener entre 5 y 9 dígitos";

const fechaNacimientoSchema = z
  .string()
  .regex(DATE_ISO, DATE_ISO_MSG)
  .refine((v) => new Date(v).getTime() <= Date.now(), "La fecha de nacimiento no puede ser futura");

/** Código del Carnet de la Patria: 10 dígitos; acepta el formato legado `000-0000000-0`. */
export function normalizarCarnetPatria(valor: string): string {
  const texto = valor.trim();
  if (/^\d{3}-\d{7}-\d$/.test(texto)) return texto.replace(/[ -]/g, "").slice(0, 10);
  return texto.replace(/[ -]/g, "");
}

export const identidadSchema = z.object({
  nombres: nombreRequerido("Los nombres"),
  apellidos: nombreRequerido("Los apellidos"),
  fecha_nacimiento: fechaNacimientoSchema,
  cedulaidentidad: z
    .string({ required_error: "La cédula es obligatoria" })
    .trim()
    .regex(CEDULA_EMPLEADO, CEDULA_EMPLEADO_MSG),
  estadoCivil_id: idCatalogoOpcional,
  carnet_patria: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => normalizarCarnetPatria(v ?? ""))
    .refine((v) => v === "" || /^\d{10}$/.test(v), "El código del Carnet de la Patria debe tener 10 dígitos"),
  carnet_patria_serial: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{0,30}$/, "El serial solo admite letras y números (máximo 30)")
    .optional()
    .or(z.literal("")),
});
export type IdentidadValores = z.infer<typeof identidadSchema>;

// ── Salud y tallas (D21, sin documento) ──
const listaIds = z
  .array(z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]))
  .transform((valores) => [...new Set(valores.map(Number))].sort((a, b) => a - b))
  .default([]);

export const perfilSaludSchema = z.object({
  grupo_sanguineo_id: idCatalogoOpcional,
  alergias: listaIds,
  patologias_cronicas: listaIds,
  discapacidades: listaIds,
});
export type PerfilSaludValores = z.infer<typeof perfilSaludSchema>;

export const perfilFisicoSchema = z.object({
  talla_camisa_id: idCatalogoOpcional,
  talla_pantalon_id: idCatalogoOpcional,
  talla_zapatos_id: idCatalogoOpcional,
  talla_chaqueta_id: idCatalogoOpcional,
});
export type PerfilFisicoValores = z.infer<typeof perfilFisicoSchema>;

// ── Bienestar ──
export const habilitarVentanaSchema = z.object({
  plazoDias: z.coerce
    .number({ invalid_type_error: "Indique el plazo en días" })
    .int("El plazo debe ser un número entero")
    .min(PLAZO_MIN_DIAS, `El plazo mínimo es ${PLAZO_MIN_DIAS} día`)
    .max(PLAZO_MAX_DIAS, `El plazo máximo es ${PLAZO_MAX_DIAS} días`),
  secciones: z.array(z.string()).min(1, "Habilite al menos una sección"),
});
export type HabilitarVentanaValores = z.infer<typeof habilitarVentanaSchema>;

export const prorrogaSchema = z.object({
  nuevaFechaFin: z
    .string()
    .min(1, "Indique la nueva fecha límite")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Fecha inválida")
    .refine(
      (v) => new Date(v).getTime() > Date.now(),
      "La nueva fecha límite debe ser posterior a hoy",
    ),
  motivo: textoLibreRequerido("El motivo", LIMITES_TEXTO.motivo),
});
export type ProrrogaValores = z.infer<typeof prorrogaSchema>;

export const rechazoSchema = z.object({
  motivo: textoLibreRequerido("El motivo del rechazo", LIMITES_TEXTO.motivo),
});
export type RechazoValores = z.infer<typeof rechazoSchema>;

export const devolucionSchema = z.object({
  motivo: textoLibreRequerido("El motivo de la devolución", LIMITES_TEXTO.motivo),
});
export type DevolucionValores = z.infer<typeof devolucionSchema>;

/** Filtros de la bandeja de Bienestar. */
export const filtrosBandejaSchema = z.object({
  estado: z.string().optional(),
  cedula: z
    .string()
    .trim()
    .regex(/^[A-Za-z]?-?\d{0,10}$/, "La cédula solo admite dígitos")
    .optional()
    .or(z.literal("")),
});
export type FiltrosBandejaValores = z.infer<typeof filtrosBandejaSchema>;

// ── Esquema por sección + entidad (formularios del borrador) ──
const tieneHijosSchema = z.object({
  tiene_hijos: z.union([
    z.enum(["true", "false"]).transform((v) => v === "true"),
    z.literal("").transform(() => null),
  ]),
});

/** Esquema del formulario según `seccion:entidad`. El servidor revalida todo. */
export const ESQUEMAS_ENTIDAD = {
  "identidad:employee": identidadSchema,
  "contacto:employee": contactoSchema.pick({ telefono_movil: true, telefono_habitacion: true }),
  "contacto:datos_complementarios": contactoSchema.pick({ correo_alternativo: true }),
  "contacto:contacto_emergencia": contactoEmergenciaSchema,
  "vivienda:datos_vivienda": viviendaSchema,
  "formacion:formacion_academica": formacionSchema,
  "familiar:datos_complementarios": tieneHijosSchema,
  "familiar:familiar": familiarSchema,
  "salud:perfil_salud": perfilSaludSchema,
  "salud:perfil_fisico": perfilFisicoSchema,
} as const;

export type ClaveEsquemaEntidad = keyof typeof ESQUEMAS_ENTIDAD;

export function esquemaDeEntidad(seccion: string, entidad: string) {
  const clave = `${seccion}:${entidad}`;
  return clave in ESQUEMAS_ENTIDAD ? ESQUEMAS_ENTIDAD[clave as ClaveEsquemaEntidad] : null;
}

/** Valor del formulario (texto) a partir del dato de la ficha. */
export function valorATexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor);
}
