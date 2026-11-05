import { LIMITES_TEXTO, textoLibreRequerido } from "@/shared/validation/limites-texto";
import { z } from "zod";
import { EMAIL, EMAIL_MSG, NO_HTML, NO_HTML_MSG } from "@/shared/validation";
import { telefonoZod } from "@/shared/domain/validation/telefono";
import { MAX_DIAS_RECORDATORIO } from "../../domain/services/reglas";
import { MAX_LONGITUD_MOTIVO } from "../../domain/value-objects/estados";

/** Teléfonos con código de país (D-13): el celular es obligatorio y móvil; la habitación es opcional y puede ser fija. */
const MENSAJE_CELULAR_OBLIGATORIO = "El teléfono celular es obligatorio";
const telefonoMovilObligatorio = z
  .string({ required_error: MENSAJE_CELULAR_OBLIGATORIO, invalid_type_error: MENSAJE_CELULAR_OBLIGATORIO })
  .trim()
  .min(1, MENSAJE_CELULAR_OBLIGATORIO)
  .pipe(telefonoZod({ tipo: "movil" }))
  .transform((v) => v ?? "");
const telefonoHabitacionOpcional = telefonoZod({ tipo: "cualquiera" }).transform((v) => v ?? "");

const motivo = (nombre: string) => textoLibreRequerido(nombre, LIMITES_TEXTO.motivo);

// ── Pasivo: datos de contacto del acta ──
export const datosContactoSchema = z.object({
  telefonoMovil: telefonoMovilObligatorio,
  telefonoHabitacion: telefonoHabitacionOpcional,
  correoAlternativo: z.string().trim().max(254, "El correo no puede superar 254 caracteres").regex(EMAIL, EMAIL_MSG).or(z.literal("")),
  tieneHijos: z.enum(["si", "no"], {
    errorMap: () => ({ message: "Indique si tiene hijos" }),
  }),
});
export type DatosContactoValores = z.infer<typeof datosContactoSchema>;

export const confirmacionEnvioSchema = z.object({
  declaro: z.literal(true, {
    errorMap: () => ({ message: "Debe confirmar que los datos son verdaderos" }),
  }),
});
export type ConfirmacionEnvioValores = z.infer<typeof confirmacionEnvioSchema>;

// ── Bienestar: decisiones ──
export const devolverSchema = z.object({
  motivo: motivo("El motivo"),
  requiereNuevaFoto: z.boolean(),
});
export type DevolverValores = z.infer<typeof devolverSchema>;

/** Campo `texto` obligatorio (motivo o justificación) con el nombre pedido en el mensaje. */
export const textoObligatorioSchema = (nombre: string) => z.object({ texto: motivo(nombre) });
export type TextoObligatorioValores = z.infer<ReturnType<typeof textoObligatorioSchema>>;

/** Retiro del check: mismas reglas que el servidor (mínimo 5 palabras y 20 caracteres, sin HTML). */
export const RETIRO_MIN_PALABRAS = 5;
export const RETIRO_MIN_CARACTERES = 20;
export const retirarCheckSchema = z.object({
  motivo: z
    .string({ required_error: "La justificación es obligatoria" })
    .trim()
    .min(1, "La justificación es obligatoria")
    .max(MAX_LONGITUD_MOTIVO, `La justificación no puede superar ${MAX_LONGITUD_MOTIVO} caracteres`)
    .regex(NO_HTML, NO_HTML_MSG)
    .refine(
      (v) =>
        v.replace(/\s+/g, " ").length >= RETIRO_MIN_CARACTERES &&
        v.split(/\s+/).filter(Boolean).length >= RETIRO_MIN_PALABRAS,
      `Explique el motivo con al menos ${RETIRO_MIN_PALABRAS} palabras y ${RETIRO_MIN_CARACTERES} caracteres`,
    ),
});
export type RetirarCheckValores = z.infer<typeof retirarCheckSchema>;

export const rechazarSchema = z.object({ motivo: motivo("El motivo") });
export type RechazarValores = z.infer<typeof rechazarSchema>;

export const aprobarDirectoSchema = z.object({ justificacion: motivo("La justificación") });
export type AprobarDirectoValores = z.infer<typeof aprobarDirectoSchema>;

export const filtrosBandejaSchema = z
  .object({
    texto: z.string().trim().max(80, "Máximo 80 caracteres").regex(NO_HTML, NO_HTML_MSG),
    estado: z.string().max(50),
    procesoId: z.string().max(50),
    desde: z.string().max(35),
    hasta: z.string().max(35),
    historico: z.boolean().optional(),
  })
  .refine((v) => !v.desde || !v.hasta || v.desde <= v.hasta, {
    message: "La fecha «desde» no puede ser posterior a «hasta»",
    path: ["hasta"],
  });
export type FiltrosBandejaValores = z.infer<typeof filtrosBandejaSchema>;

// ── Procesos y prórrogas ──
export const procesoSchema = z
  .object({
    nombre: z
      .string({ required_error: "El nombre es obligatorio" })
      .trim()
      .min(3, "El nombre es obligatorio")
      .max(160, "Máximo 160 caracteres")
      .regex(NO_HTML, NO_HTML_MSG),
    apertura: z.string().min(1, "La apertura es obligatoria").max(35, "Máximo 35 caracteres"),
    cierre: z.string().min(1, "El cierre es obligatorio").max(35, "Máximo 35 caracteres"),
    todos: z.boolean(),
    tiposNomina: z.array(z.number().int().positive()),
    diasRecordatorio: z.array(
      z
        .number()
        .int("Use días enteros")
        .min(1, "El mínimo es 1 día")
        .max(MAX_DIAS_RECORDATORIO, `El máximo es ${MAX_DIAS_RECORDATORIO} días`),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.apertura && v.cierre && v.cierre <= v.apertura) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El cierre debe ser posterior a la apertura",
        path: ["cierre"],
      });
    }
    if (!v.todos && v.tiposNomina.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Elija al menos un tipo de pensión o marque «Todos»",
        path: ["tiposNomina"],
      });
    }
  });
export type ProcesoValores = z.infer<typeof procesoSchema>;

export const prorrogaSchema = z.object({
  cedula: z
    .string()
    .trim()
    .regex(/^(\d{5,10})?$/, "La cédula debe tener entre 5 y 10 dígitos, sin puntos"),
  nuevaFechaLimite: z.string().min(1, "La nueva fecha límite es obligatoria").max(35, "Máximo 35 caracteres"),
  motivo: motivo("El motivo"),
});
export type ProrrogaValores = z.infer<typeof prorrogaSchema>;

export const filtrosCoberturaSchema = z.object({
  texto: z.string().trim().max(80, "Máximo 80 caracteres").regex(NO_HTML, NO_HTML_MSG),
  tipoNominaId: z.string().max(10).regex(/^\d*$/),
  sinCorreo: z.boolean(),
  sinCuenta: z.boolean(),
});
export type FiltrosCoberturaValores = z.infer<typeof filtrosCoberturaSchema>;
