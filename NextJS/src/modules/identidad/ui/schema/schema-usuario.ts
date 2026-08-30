/**
 * Schemas Zod del módulo identidad (Regla R7). Mensajes y formatos
 * centralizados en `@/shared/domain/validation` — cero regex inline.
 */
import { z } from "zod";
import { ERROR, REGEX } from "@/shared/domain/validation";

/** Filtros opcionales del listado de usuarios (se re-validan en la Server Action). */
export const usuariosFiltrosSchema = z.object({
  busqueda: z
    .string()
    .trim()
    .max(100, ERROR.MAX_LENGTH(100))
    .regex(REGEX.SAFE_TEXT, "Contiene caracteres no permitidos")
    .optional()
    .or(z.literal("")),
  departamentoId: z.number().int().positive().optional().nullable(),
  rolId: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional().nullable(),
});

/** Alta de cuenta (zero-trust R7). */
export const registrarUsuarioSchema = z.object({
  cedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula inválida (solo dígitos)" }),
  password: z
    .string()
    .min(8, ERROR.MIN_LENGTH(8))
    .regex(REGEX.PASSWORD, ERROR.INVALID_PASSWORD),
  departamentoId: z.number().int().positive().optional().nullable(),
  rolId: z.number().int().positive().optional().nullable(),
});

/** Edición parcial de cuenta (zero-trust R7). */
export const editarUsuarioSchema = z.object({
  departamentoId: z.number().int().positive().optional().nullable(),
  rolId: z.number().int().positive().optional().nullable(),
  password: z
    .string()
    .refine((v) => !v || v.trim().length === 0 || (v.trim().length >= 8 && REGEX.PASSWORD.test(v)), ERROR.INVALID_PASSWORD)
    .optional()
    .nullable(),
});

/** Cambio de estado de cuenta (zero-trust R7). */
export const cambiarEstadoUsuarioSchema = z.object({
  isActive: z.boolean().optional(),
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
  password: z.string().optional().nullable(),
  departamentoId: z.number().int().positive().optional().nullable(),
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
  descripcionRol: z
    .string()
    .trim()
    .max(500, ERROR.MAX_LENGTH(500))
    .optional()
    .nullable(),
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
export type RolFormType = z.infer<typeof rolSchema>;
