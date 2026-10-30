import { z } from "zod";
import { EMAIL, EMAIL_MSG, NO_HTML, NO_HTML_MSG } from "@/shared/validation";
import { parsearDiasRecordatorio } from "../../domain/services/reglas";
import { MAX_LONGITUD_MOTIVO } from "../../domain/value-objects/estados";

/** Mismo criterio que el servidor: +, dígitos, espacios y guiones. */
export const TELEFONO = /^\+?\d[\d\s-]{6,18}\d$/;
export const TELEFONO_MSG = "Teléfono inválido. Ejemplo: 0412-1234567";

const telefonoOpcional = z
  .string()
  .trim()
  .regex(TELEFONO, TELEFONO_MSG)
  .or(z.literal(""));

const motivo = (nombre: string) =>
  z
    .string({ required_error: `${nombre} es obligatorio` })
    .trim()
    .min(3, `${nombre} es obligatorio (mínimo 3 caracteres)`)
    .max(MAX_LONGITUD_MOTIVO, `${nombre} no puede superar ${MAX_LONGITUD_MOTIVO} caracteres`)
    .regex(NO_HTML, NO_HTML_MSG);

// ── Pasivo: datos de contacto del acta ──
export const datosContactoSchema = z.object({
  telefonoMovil: telefonoOpcional,
  telefonoHabitacion: telefonoOpcional,
  correoAlternativo: z.string().trim().regex(EMAIL, EMAIL_MSG).or(z.literal("")),
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

export const rechazarSchema = z.object({ motivo: motivo("El motivo") });
export type RechazarValores = z.infer<typeof rechazarSchema>;

export const aprobarDirectoSchema = z.object({ justificacion: motivo("La justificación") });
export type AprobarDirectoValores = z.infer<typeof aprobarDirectoSchema>;

export const filtrosBandejaSchema = z
  .object({
    texto: z.string().trim().max(80, "Máximo 80 caracteres").regex(NO_HTML, NO_HTML_MSG),
    estado: z.string(),
    procesoId: z.string(),
    desde: z.string(),
    hasta: z.string(),
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
    apertura: z.string().min(1, "La apertura es obligatoria"),
    cierre: z.string().min(1, "El cierre es obligatorio"),
    todos: z.boolean(),
    tiposNomina: z.array(z.number().int().positive()),
    diasRecordatorio: z.string().trim(),
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
    if (v.diasRecordatorio && parsearDiasRecordatorio(v.diasRecordatorio) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use números de días separados por coma. Ejemplo: 7, 3, 1",
        path: ["diasRecordatorio"],
      });
    }
  });
export type ProcesoValores = z.infer<typeof procesoSchema>;

export const prorrogaSchema = z.object({
  cedula: z
    .string()
    .trim()
    .regex(/^(\d{5,10})?$/, "La cédula debe tener entre 5 y 10 dígitos, sin puntos"),
  nuevaFechaLimite: z.string().min(1, "La nueva fecha límite es obligatoria"),
  motivo: motivo("El motivo"),
});
export type ProrrogaValores = z.infer<typeof prorrogaSchema>;

export const filtrosCoberturaSchema = z.object({
  texto: z.string().trim().max(80, "Máximo 80 caracteres").regex(NO_HTML, NO_HTML_MSG),
  tipoNominaId: z.string().regex(/^\d*$/),
  sinCorreo: z.boolean(),
  sinCuenta: z.boolean(),
});
export type FiltrosCoberturaValores = z.infer<typeof filtrosCoberturaSchema>;
