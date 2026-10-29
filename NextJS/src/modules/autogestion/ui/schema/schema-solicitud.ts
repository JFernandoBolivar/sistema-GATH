import { z } from "zod";
import {
  DATE_ISO,
  DATE_ISO_MSG,
  EMAIL,
  EMAIL_MSG,
  NO_HTML,
  NO_HTML_MSG,
} from "@/shared/validation";
import { SECCIONES } from "../../domain/entities/solicitud-actualizacion";
import {
  PLAZO_MAX_DIAS,
  PLAZO_MIN_DIAS,
} from "../../application/use-cases/gestionar-solicitud-bienestar";

/** Mismo criterio que el servidor (`validacion_cambios.py`): +, dígitos, espacios y guiones. */
export const TELEFONO_AUTOGESTION = /^\+?\d[\d\s-]{6,18}\d$/;
export const TELEFONO_AUTOGESTION_MSG = "Teléfono inválido. Ejemplo: 0412-1234567";
export const CEDULA_FAMILIAR = /^[A-Za-z]?-?\d{5,10}$/;
export const CEDULA_FAMILIAR_MSG = "Cédula inválida. Ejemplo: V-12345678";

const MOTIVO_MAX = 500;

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

const telefonoOpcional = z
  .string()
  .trim()
  .regex(TELEFONO_AUTOGESTION, TELEFONO_AUTOGESTION_MSG)
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
export const solicitudNuevaSchema = z.object({
  secciones: z.array(z.enum(SECCIONES)).min(1, "Elija al menos una sección para actualizar"),
  motivo: textoRequerido("El motivo", MOTIVO_MAX),
});
export type SolicitudNuevaValores = z.infer<typeof solicitudNuevaSchema>;

// ── Secciones del borrador ──
export const contactoSchema = z.object({
  telefono_movil: telefonoOpcional,
  telefono_habitacion: telefonoOpcional,
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
  nombres: textoRequerido("Los nombres"),
  apellidos: textoRequerido("Los apellidos"),
  telefono: telefonoOpcional,
  relacion_id: idCatalogoOpcional,
});
export type ContactoEmergenciaValores = z.infer<typeof contactoEmergenciaSchema>;

export const viviendaSchema = z.object({
  estado_id: idCatalogo("el estado"),
  municipio_id: idCatalogo("el municipio"),
  parroquia_id: idCatalogo("la parroquia"),
  direccion_exacta: textoRequerido("La dirección", 500),
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

export const familiarSchema = z.object({
  primer_nombre: textoRequerido("El primer nombre"),
  segundo_nombre: textoOpcional(),
  primer_apellido: textoRequerido("El primer apellido"),
  segundo_apellido: textoOpcional(),
  cedula_familiar: z
    .string()
    .trim()
    .regex(CEDULA_FAMILIAR, CEDULA_FAMILIAR_MSG)
    .optional()
    .or(z.literal("")),
  parentesco_id: idCatalogo("el parentesco"),
  fecha_nacimiento: z
    .string()
    .regex(DATE_ISO, DATE_ISO_MSG)
    .refine(
      (v) => new Date(v).getTime() <= Date.now(),
      "La fecha de nacimiento no puede ser futura",
    ),
  sexo_id: idCatalogo("el sexo"),
  observaciones: textoOpcional(1000),
});
export type FamiliarValores = z.infer<typeof familiarSchema>;

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
  motivo: textoRequerido("El motivo", MOTIVO_MAX),
});
export type ProrrogaValores = z.infer<typeof prorrogaSchema>;

export const rechazoSchema = z.object({
  motivo: textoRequerido("El motivo del rechazo", MOTIVO_MAX),
});
export type RechazoValores = z.infer<typeof rechazoSchema>;

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
  "contacto:employee": contactoSchema.pick({ telefono_movil: true, telefono_habitacion: true }),
  "contacto:datos_complementarios": contactoSchema.pick({ correo_alternativo: true }),
  "contacto:contacto_emergencia": contactoEmergenciaSchema,
  "vivienda:datos_vivienda": viviendaSchema,
  "formacion:formacion_academica": formacionSchema,
  "familiar:datos_complementarios": tieneHijosSchema,
  "familiar:familiar": familiarSchema,
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
