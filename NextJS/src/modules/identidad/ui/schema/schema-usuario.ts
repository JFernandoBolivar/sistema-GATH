/**
 * Schemas Zod del módulo identidad (Regla R7). Mensajes y formatos
 * centralizados en `@/shared/domain/validation` — cero regex inline.
 */
import { LIMITES_TEXTO, textoLibreOpcional, textoLibreRequerido } from "@/shared/validation/limites-texto";
import { z } from "zod";
import { ERROR, REGEX } from "@/shared/domain/validation";

/** Filtros del listado paginado de usuarios (se re-validan en la Server Action). */
export const usuariosFiltrosSchema = z.object({
  cedula: z
    .string()
    .trim()
    .max(20, ERROR.MAX_LENGTH(20))
    .regex(REGEX.SAFE_TEXT, "Contiene caracteres no permitidos")
    .optional()
    .or(z.literal("")),
  nombre: z
    .string()
    .trim()
    .max(100, ERROR.MAX_LENGTH(100))
    .regex(REGEX.SAFE_TEXT, "Contiene caracteres no permitidos")
    .optional()
    .or(z.literal("")),
  correo: z
    .string()
    .trim()
    .max(120, ERROR.MAX_LENGTH(120))
    .regex(REGEX.SAFE_TEXT, "Contiene caracteres no permitidos")
    .optional()
    .or(z.literal("")),
  rolId: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional().nullable(),
  condicion: z.enum(["ACTIVO", "PASIVO"]).optional().nullable(),
  pagina: z.number().int().positive().optional(),
  pageSize: z.number().int().min(1).max(50).optional(),
});

/** Alta de cuenta (zero-trust R7). D3: sin departamento. O17: password opcional en UI (la inicial es la cédula). */
export const registrarUsuarioSchema = z.object({
  cedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula inválida (solo dígitos)" }),
  password: z
    .string()
    .min(8, ERROR.MIN_LENGTH(8))
    .max(128, ERROR.MAX_LENGTH(128))
    .regex(REGEX.PASSWORD, ERROR.INVALID_PASSWORD)
    .optional()
    .or(z.literal("")),
  rolId: z.number().int().positive().optional().nullable(),
});

/** Edición de rol (D4/M2: la contraseña no se cambia por este endpoint). */
export const editarUsuarioSchema = z.object({
  rolId: z.number().int().positive().optional().nullable(),
  motivo: textoLibreOpcional("El motivo", LIMITES_TEXTO.motivo).optional(),
});

/** Cambio de estado (D4: motivo obligatorio). */
export const cambiarEstadoUsuarioSchema = z.object({
  isActive: z.boolean(),
  motivo: textoLibreRequerido("El motivo", LIMITES_TEXTO.motivo),
});

/** Overrides individuales (D4: motivo obligatorio). */
export const guardarOverridesSchema = z.object({
  allow: z.array(z.string().trim().min(1).max(100)).max(500),
  deny: z.array(z.string().trim().min(1).max(100)).max(500),
  motivo: textoLibreRequerido("El motivo", LIMITES_TEXTO.motivo),
});

/** Matriz de permisos (D4: confirmación y motivo). */
export const guardarMatrizSchema = z.object({
  rolId: z.number().int().positive({ message: "Rol inválido" }),
  permisos: z.array(z.string().trim().min(1).max(100)).max(500),
  motivo: textoLibreRequerido("El motivo", LIMITES_TEXTO.motivo),
});

/** «Restablecer acceso» (A1): motivo obligatorio para la auditoría. */
export const restablecerAccesoSchema = z.object({
  motivo: textoLibreRequerido("El motivo", LIMITES_TEXTO.motivo),
});

/** Correo de acceso (D8/A2). */
export const cambiarCorreoAccesoSchema = z
  .object({
    fuente: z.enum(["INSTITUCIONAL", "ALTERNATIVO", "OTRO"]),
    correo: z
      .string()
      .trim()
      .email("Correo inválido")
      .max(254, ERROR.MAX_LENGTH(254))
      .optional()
      .or(z.literal("")),
    motivo: textoLibreRequerido("El motivo", LIMITES_TEXTO.motivo),
  })
  .refine((v) => v.fuente !== "OTRO" || !!v.correo, {
    message: "Indique el correo cuando la fuente es OTRO",
    path: ["correo"],
  });

/**
 * Schema del formulario de alta/edición de la UI (Regla R8). Permite contraseña
 * vacía al editar (significa "no cambiar"); la fortaleza se re-valida en la
 * Server Action con `registrarUsuarioSchema`/`editarUsuarioSchema`.
 */
export const usuarioFormSchema = z.object({
  cedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula inválida (solo dígitos)" }),
  password: z.string().max(128, ERROR.MAX_LENGTH(128)).optional().nullable(),
  rolId: z.number().int().positive().optional().nullable(),
});

/** Identificador de usuario (zero-trust R7). */
export const usuarioIdSchema = z.object({
  usuarioId: z.number().int().positive({ message: "Usuario inválido" }),
});

/** Alta/edición de rol del catálogo (zero-trust R7). */
export const rolSchema = z.object({
  nombreRol: z
    .string()
    .trim()
    .min(2, ERROR.MIN_LENGTH(2))
    .max(50, ERROR.MAX_LENGTH(50)),
  descripcionRol: textoLibreOpcional("La descripción", LIMITES_TEXTO.observacion).optional().nullable(),
});

/** Identificador de rol (zero-trust R7). */
export const rolIdSchema = z.object({
  rolId: z.number().int().positive({ message: "Rol inválido" }),
});

export type UsuariosFiltrosType = z.infer<typeof usuariosFiltrosSchema>;
export type RegistrarUsuarioFormType = z.infer<typeof registrarUsuarioSchema>;
export type UsuarioFormType = z.infer<typeof usuarioFormSchema>;
export type EditarUsuarioFormType = z.infer<typeof editarUsuarioSchema>;
export type CambiarEstadoUsuarioFormType = z.infer<typeof cambiarEstadoUsuarioSchema>;
export type GuardarOverridesFormType = z.infer<typeof guardarOverridesSchema>;
export type GuardarMatrizFormType = z.infer<typeof guardarMatrizSchema>;
export type CambiarCorreoAccesoFormType = z.infer<typeof cambiarCorreoAccesoSchema>;
export type RestablecerAccesoFormType = z.infer<typeof restablecerAccesoSchema>;
export type RolFormType = z.infer<typeof rolSchema>;
