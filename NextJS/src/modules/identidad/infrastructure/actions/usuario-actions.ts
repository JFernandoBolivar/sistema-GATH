"use server";

/**
 * Server Actions del módulo identidad (Regla R7).
 * Zero-trust: los datos que llegan del cliente se re-validan con el schema Zod
 * antes de invocar el caso de uso. Captura errores y llama `handleSessionExpired`
 * (R7); registra auditoría en `logs/frontend/audit_frontend.txt` (D-04/C-5).
 * S17: no se registran PII.
 */
import type { ZodError } from "zod";

import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { errorDeAccion, handleSessionExpired } from "@/shared/infrastructure/http/errors";
import { repoUsuariosApi } from "../repositories/repo-usuarios-api";
import { repoRolesApi } from "../repositories/repo-roles-api";
import { listarPermisos, listarUsuarios, obtenerDetalleUsuario } from "../../application/use-cases/listar-usuarios";
import {
  cambiarCorreoAcceso,
  cambiarEstadoUsuario,
  editarUsuario,
  guardarMatrizPermisos,
  guardarOverridesUsuario,
  obtenerMatrizPermisos,
  registrarUsuario,
  restablecerAccesoUsuario,
} from "../../application/use-cases/gestionar-usuario";
import { listarRoles } from "../../application/use-cases/gestionar-roles";
import {
  cambiarCorreoAccesoSchema,
  cambiarEstadoUsuarioSchema,
  editarUsuarioSchema,
  guardarMatrizSchema,
  guardarOverridesSchema,
  registrarUsuarioSchema,
  restablecerAccesoSchema,
  rolIdSchema,
  rolSchema,
  usuarioIdSchema,
  usuariosFiltrosSchema,
  type UsuariosFiltrosType,
} from "../../ui/schema/schema-usuario";
import { actualizarRol, crearRol, eliminarRol } from "../../application/use-cases/gestionar-roles";

/** Convierte los issues de Zod en `{ campo: ["mensaje"] }` para el formulario. */
function erroresDeZod(error: ZodError): Record<string, string[]> {
  const salida: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const ruta = issue.path.join(".");
    if (!ruta) continue;
    (salida[ruta] ??= []).push(issue.message);
  }
  return salida;
}

/** Lista usuarios paginados para la pantalla de administración (D4). */
export async function listarUsuariosAction(rawFiltros?: unknown) {
  const parsed = usuariosFiltrosSchema.safeParse(rawFiltros ?? {});
  if (!parsed.success) {
    return {
      error: "Filtros inválidos. Revise los valores ingresados.",
      errores: erroresDeZod(parsed.error),
    } as const;
  }
  const filtros: UsuariosFiltrosType = parsed.data;

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const pagina = await listarUsuarios(repoUsuariosApi, {
      cedula: filtros.cedula || undefined,
      nombre: filtros.nombre || undefined,
      correo: filtros.correo || undefined,
      rolId: filtros.rolId ?? undefined,
      isActive: filtros.isActive ?? undefined,
      condicion: filtros.condicion ?? undefined,
      pagina: filtros.pagina ?? 1,
      pageSize: filtros.pageSize ?? 10,
    });
    await logAudit({ traceId, action: "listarUsuariosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return pagina;
  } catch (error) {
    await logAudit({ traceId, action: "listarUsuariosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible cargar los usuarios.");
  }
}

/** Detalle de una cuenta con su permiso efectivo calculado en el servidor (D4). */
export async function obtenerDetalleUsuarioAction(id: number) {
  const idValido = usuarioIdSchema.safeParse({ usuarioId: id });
  if (!idValido.success) return { error: "Usuario inválido." } as const;

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const detalle = await obtenerDetalleUsuario(repoUsuariosApi, idValido.data.usuarioId);
    await logAudit({ traceId, action: "obtenerDetalleUsuarioAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return detalle;
  } catch (error) {
    await logAudit({ traceId, action: "obtenerDetalleUsuarioAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function registrarUsuarioAction(input: {
  cedula: string;
  password?: string;
  rolId?: number | null;
}) {
  const validation = registrarUsuarioSchema.safeParse(input);
  if (!validation.success) {
    return {
      error: "Datos del usuario inválidos. Revise los campos marcados en rojo.",
      errores: erroresDeZod(validation.error),
    } as const;
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const usuario = await registrarUsuario(repoUsuariosApi, validation.data);
    await logAudit({ traceId, action: "registrarUsuarioAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return usuario;
  } catch (error) {
    await logAudit({ traceId, action: "registrarUsuarioAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible registrar el usuario.");
  }
}

export async function editarUsuarioAction(id: number, input: {
  rolId?: number | null;
  motivo?: string;
}) {
  const idValido = usuarioIdSchema.safeParse({ usuarioId: id });
  const dataValida = editarUsuarioSchema.safeParse(input);
  if (!idValido.success || !dataValida.success) {
    return {
      error: "Datos del usuario inválidos. Revise los campos marcados en rojo.",
      errores: dataValida.success ? undefined : erroresDeZod(dataValida.error),
    } as const;
  }
  if (dataValida.data.rolId && (!dataValida.data.motivo || dataValida.data.motivo.trim().length < 10)) {
    return {
      error: "Indique el motivo del cambio de rol (al menos 10 caracteres).",
      errores: { motivo: ["Indique el motivo del cambio de rol (al menos 10 caracteres)."] },
    } as const;
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const usuario = await editarUsuario(repoUsuariosApi, idValido.data.usuarioId, dataValida.data);
    await logAudit({ traceId, action: "editarUsuarioAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return usuario;
  } catch (error) {
    await logAudit({ traceId, action: "editarUsuarioAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible actualizar el usuario.");
  }
}

export async function cambiarEstadoUsuarioAction(id: number, isActive: boolean, motivo: string) {
  const idValido = usuarioIdSchema.safeParse({ usuarioId: id });
  const dataValida = cambiarEstadoUsuarioSchema.safeParse({ isActive, motivo });
  if (!idValido.success || !dataValida.success) {
    return {
      error: "Indique el motivo (al menos 10 caracteres).",
      errores: dataValida.success ? undefined : erroresDeZod(dataValida.error),
    } as const;
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const usuario = await cambiarEstadoUsuario(repoUsuariosApi, idValido.data.usuarioId, dataValida.data);
    await logAudit({ traceId, action: "cambiarEstadoUsuarioAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return usuario;
  } catch (error) {
    await logAudit({ traceId, action: "cambiarEstadoUsuarioAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible cambiar el estado del usuario.");
  }
}

/** D8: «Restablecer acceso» (RRHH). El permiso y la regla A1 los exige el backend. */
export async function restablecerAccesoAction(id: number, motivo: string) {
  const idValido = usuarioIdSchema.safeParse({ usuarioId: id });
  const dataValida = restablecerAccesoSchema.safeParse({ motivo });
  if (!idValido.success || !dataValida.success) {
    return {
      error: "Indique el motivo (al menos 10 caracteres).",
      errores: dataValida.success ? undefined : erroresDeZod(dataValida.error),
    } as const;
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const usuario = await restablecerAccesoUsuario(
      repoUsuariosApi,
      idValido.data.usuarioId,
      dataValida.data.motivo,
    );
    await logAudit({ traceId, action: "restablecerAccesoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return usuario;
  } catch (error) {
    await logAudit({ traceId, action: "restablecerAccesoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible restablecer el acceso.");
  }
}

/** D8: elige el correo de acceso de un pasivo o trabajador (A2). */
export async function cambiarCorreoAccesoAction(
  cedula: string,
  input: { fuente: string; correo?: string; motivo: string },
) {
  const dataValida = cambiarCorreoAccesoSchema.safeParse(input);
  if (!dataValida.success) {
    return {
      error: "Datos del correo inválidos. Indique el motivo (mínimo 10 caracteres).",
      errores: erroresDeZod(dataValida.error),
    } as const;
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const resultado = await cambiarCorreoAcceso(repoUsuariosApi, {
      cedula,
      fuente: dataValida.data.fuente,
      correo: dataValida.data.correo || undefined,
      motivo: dataValida.data.motivo,
    });
    await logAudit({ traceId, action: "cambiarCorreoAccesoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return resultado;
  } catch (error) {
    await logAudit({ traceId, action: "cambiarCorreoAccesoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible cambiar el correo de acceso.");
  }
}

/** D4: overrides individuales allow/deny. */
export async function guardarOverridesAction(id: number, input: { allow: string[]; deny: string[]; motivo: string }) {
  const idValido = usuarioIdSchema.safeParse({ usuarioId: id });
  const dataValida = guardarOverridesSchema.safeParse(input);
  if (!idValido.success || !dataValida.success) {
    return {
      error: "Datos de permisos inválidos. Indique el motivo (mínimo 10 caracteres).",
      errores: dataValida.success ? undefined : erroresDeZod(dataValida.error),
    } as const;
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const detalle = await guardarOverridesUsuario(repoUsuariosApi, idValido.data.usuarioId, dataValida.data);
    await logAudit({ traceId, action: "guardarOverridesAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return detalle;
  } catch (error) {
    await logAudit({ traceId, action: "guardarOverridesAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible guardar los permisos individuales.");
  }
}

export async function obtenerMatrizAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const matriz = await obtenerMatrizPermisos(repoUsuariosApi);
    await logAudit({ traceId, action: "obtenerMatrizAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return matriz;
  } catch (error) {
    await logAudit({ traceId, action: "obtenerMatrizAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function guardarMatrizAction(rolId: number, permisos: string[], motivo: string) {
  const dataValida = guardarMatrizSchema.safeParse({ rolId, permisos, motivo });
  if (!dataValida.success) {
    return {
      error: "Indique el motivo (mínimo 10 caracteres) y confirme el cambio.",
      errores: erroresDeZod(dataValida.error),
    } as const;
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const matriz = await guardarMatrizPermisos(
      repoUsuariosApi,
      dataValida.data.rolId,
      dataValida.data.permisos,
      dataValida.data.motivo,
    );
    await logAudit({ traceId, action: "guardarMatrizAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return matriz;
  } catch (error) {
    await logAudit({ traceId, action: "guardarMatrizAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible guardar la matriz de permisos.");
  }
}

export async function getPermisosAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const permisos = await listarPermisos(repoUsuariosApi);
    await logAudit({ traceId, action: "getPermisosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return permisos;
  } catch (error) {
    await logAudit({ traceId, action: "getPermisosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getRolesAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const roles = await listarRoles(repoRolesApi);
    await logAudit({ traceId, action: "getRolesAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return roles;
  } catch (error) {
    await logAudit({ traceId, action: "getRolesAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function crearRolAction(input: { nombreVisible: string; descripcionRol?: string | null }) {
  const validation = rolSchema.safeParse(input);
  if (!validation.success) {
    return {
      error: "Datos del rol inválidos. Revise los campos marcados en rojo.",
      errores: erroresDeZod(validation.error),
    } as const;
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const rol = await crearRol(repoRolesApi, validation.data);
    await logAudit({ traceId, action: "crearRolAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return rol;
  } catch (error) {
    await logAudit({ traceId, action: "crearRolAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible crear el rol.");
  }
}

export async function actualizarRolAction(id: number, input: { nombreVisible: string; descripcionRol?: string | null }) {
  const idValido = rolIdSchema.safeParse({ rolId: id });
  const dataValida = rolSchema.safeParse(input);
  if (!idValido.success || !dataValida.success) {
    return {
      error: "Datos del rol inválidos. Revise los campos marcados en rojo.",
      errores: dataValida.success ? undefined : erroresDeZod(dataValida.error),
    } as const;
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const rol = await actualizarRol(repoRolesApi, idValido.data.rolId, dataValida.data);
    await logAudit({ traceId, action: "actualizarRolAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return rol;
  } catch (error) {
    await logAudit({ traceId, action: "actualizarRolAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible actualizar el rol.");
  }
}

export async function eliminarRolAction(rolId: number) {
  const validation = rolIdSchema.safeParse({ rolId });
  if (!validation.success) return { error: "Rol inválido." } as const;

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarRol(repoRolesApi, validation.data.rolId);
    await logAudit({ traceId, action: "eliminarRolAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarRolAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}
