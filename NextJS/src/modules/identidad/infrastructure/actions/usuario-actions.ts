"use server";

/**
 * Server Actions del módulo identidad (Regla R7).
 * Zero-trust: los datos que llegan del cliente se re-validan con el schema Zod
 * antes de invocar el caso de uso. Captura errores y llama `handleSessionExpired`
 * (R7); registra auditoría en `logs/frontend/audit_frontend.txt` (D-04/C-5).
 * S17: no se registran PII.
 */
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import { repoUsuariosApi } from "../repositories/repo-usuarios-api";
import { repoRolesApi } from "../repositories/repo-roles-api";
import {
  listarDepartamentos,
  listarPermisos,
  listarUsuarios,
} from "../../application/use-cases/listar-usuarios";
import {
  cambiarEstadoUsuario,
  editarUsuario,
  registrarUsuario,
  restablecerAccesoUsuario,
} from "../../application/use-cases/gestionar-usuario";
import { listarRoles } from "../../application/use-cases/gestionar-roles";
import {
  cambiarEstadoUsuarioSchema,
  editarUsuarioSchema,
  registrarUsuarioSchema,
  rolIdSchema,
  rolSchema,
  usuarioIdSchema,
  usuariosFiltrosSchema,
  type UsuariosFiltrosType,
} from "../../ui/schema/schema-usuario";
import { actualizarRol, crearRol, eliminarRol } from "../../application/use-cases/gestionar-roles";

/**
 * Lista usuarios para la pantalla `usuarios-page`. Lanza el error tras manejar
 * la sesión expirada; SWR lo refleja como estado de error en el cliente.
 */
export async function listarUsuariosAction(
  rawFiltros?: unknown,
): Promise<Awaited<ReturnType<typeof listarUsuarios>>> {
  const parsed = usuariosFiltrosSchema.safeParse(rawFiltros ?? {});
  const filtros: UsuariosFiltrosType = parsed.success ? parsed.data : {};

  const traceId = generateTraceId();
  const startedAt = Date.now();

  try {
    const usuarios = await listarUsuarios(repoUsuariosApi, {
      busqueda: filtros.busqueda ?? undefined,
      departamentoId: filtros.departamentoId ?? undefined,
      rolId: filtros.rolId ?? undefined,
      isActive: filtros.isActive ?? undefined,
    });
    await logAudit({
      traceId,
      action: "listarUsuariosAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return usuarios;
  } catch (error) {
    await logAudit({
      traceId,
      action: "listarUsuariosAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function registrarUsuarioAction(input: {
  cedula: string;
  password: string;
  departamentoId?: number | null;
  rolId?: number | null;
}) {
  const validation = registrarUsuarioSchema.safeParse(input);
  if (!validation.success) {
    return { error: "Datos del usuario inválidos. Revise los campos ingresados." };
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
    throw error;
  }
}

export async function editarUsuarioAction(id: number, input: {
  departamentoId?: number | null;
  rolId?: number | null;
  password?: string | null;
}) {
  const idValido = usuarioIdSchema.safeParse({ usuarioId: id });
  const dataValida = editarUsuarioSchema.safeParse(input);
  if (!idValido.success || !dataValida.success) {
    return { error: "Datos del usuario inválidos. Revise los campos ingresados." };
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
    throw error;
  }
}

export async function cambiarEstadoUsuarioAction(id: number, isActive: boolean) {
  const idValido = usuarioIdSchema.safeParse({ usuarioId: id });
  const dataValida = cambiarEstadoUsuarioSchema.safeParse({ isActive });
  if (!idValido.success || !dataValida.success) {
    return { error: "Usuario inválido." };
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
    throw error;
  }
}

/** D8: «Restablecer acceso» (RRHH). El permiso lo exige el backend (`identidad.restablecer_acceso`). */
export async function restablecerAccesoAction(id: number) {
  const idValido = usuarioIdSchema.safeParse({ usuarioId: id });
  if (!idValido.success) {
    return { error: "Usuario inválido." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const usuario = await restablecerAccesoUsuario(repoUsuariosApi, idValido.data.usuarioId);
    await logAudit({ traceId, action: "restablecerAccesoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return usuario;
  } catch (error) {
    await logAudit({ traceId, action: "restablecerAccesoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getDepartamentosAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const departamentos = await listarDepartamentos(repoUsuariosApi);
    await logAudit({ traceId, action: "getDepartamentosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return departamentos;
  } catch (error) {
    await logAudit({ traceId, action: "getDepartamentosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
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

export async function crearRolAction(input: { nombreRol: string; descripcionRol?: string | null }) {
  const validation = rolSchema.safeParse(input);
  if (!validation.success) {
    return { error: "Datos del rol inválidos. Revise los campos ingresados." };
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
    throw error;
  }
}

export async function actualizarRolAction(id: number, input: { nombreRol: string; descripcionRol?: string | null }) {
  const idValido = rolIdSchema.safeParse({ rolId: id });
  const dataValida = rolSchema.safeParse(input);
  if (!idValido.success || !dataValida.success) {
    return { error: "Datos del rol inválidos. Revise los campos ingresados." };
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
    throw error;
  }
}

export async function eliminarRolAction(rolId: number) {
  const validation = rolIdSchema.safeParse({ rolId });
  if (!validation.success) {
    return { error: "Rol inválido." };
  }

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
