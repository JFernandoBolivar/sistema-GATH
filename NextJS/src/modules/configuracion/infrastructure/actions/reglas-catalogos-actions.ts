/**
 * Server Actions para Reglas de Catálogos (A5).
 */
"use server";

import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { errorDeAccion, handleSessionExpired } from "@/shared/infrastructure/http/errors";
import { reglasCatalogosApi } from "../http/reglas-catalogos-api";
import type { ReglaParentescoDTO } from "../../application/dtos/reglas-catalogos-dto";

async function conAuditoria<T>(
  accion: string,
  operacion: () => Promise<T>,
): Promise<T | { error: string; errores?: Record<string, string[]> }> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const resultado = await operacion();
    await logAudit({
      traceId,
      action: accion,
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return resultado;
  } catch (error) {
    await logAudit({
      traceId,
      action: accion,
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible completar la operación de reglas de catálogos.");
  }
}

export async function obtenerReglasCatalogosAction() {
  return conAuditoria("obtenerReglasCatalogosAction", async () => {
    const res = await reglasCatalogosApi.obtenerTodas();
    return res.data;
  });
}

export async function actualizarParentescoAction(id: number, aplica_familiar: boolean) {
  return conAuditoria("actualizarParentescoAction", async () => {
    const res = await reglasCatalogosApi.actualizarParentesco(id, { aplica_familiar });
    return res.data;
  });
}

export async function crearParentescoAction(
  descripcion: string,
  aplica_familiar: boolean,
  regla?: Partial<Omit<ReglaParentescoDTO, "id" | "descripcion" | "aplica_familiar">>,
) {
  return conAuditoria("crearParentescoAction", async () => {
    const res = await reglasCatalogosApi.crearParentesco(descripcion, aplica_familiar, regla);
    return res.data;
  });
}

export async function editarParentescoAction(
  id: number,
  datos: Partial<Omit<ReglaParentescoDTO, "id">>,
) {
  return conAuditoria("editarParentescoAction", async () => {
    const res = await reglasCatalogosApi.actualizarParentesco(id, datos);
    return res.data;
  });
}

export async function eliminarParentescoAction(id: number) {
  return conAuditoria("eliminarParentescoAction", async () => {
    const res = await reglasCatalogosApi.eliminarParentesco(id);
    return res.data;
  });
}

export async function cambiarCategoriaMotivoAction(id: number, categoria_id: number) {
  return conAuditoria("cambiarCategoriaMotivoAction", async () => {
    const res = await reglasCatalogosApi.cambiarCategoriaMotivo(id, categoria_id);
    return res.data;
  });
}

export async function actualizarMotivoAction(
  id: number,
  datos: { movimiento?: string; categoria_id?: number; activo?: boolean },
) {
  return conAuditoria("actualizarMotivoAction", async () => {
    const res = await reglasCatalogosApi.actualizarMotivo(id, datos);
    return res.data;
  });
}

export async function eliminarMotivoAction(id: number) {
  return conAuditoria("eliminarMotivoAction", async () => {
    const res = await reglasCatalogosApi.eliminarMotivo(id);
    return res.data;
  });
}

export async function crearMotivoAction(movimiento: string, categoria_id: number) {
  return conAuditoria("crearMotivoAction", async () => {
    const res = await reglasCatalogosApi.crearMotivo(movimiento, categoria_id);
    return res.data;
  });
}

export async function actualizarNominaAction(
  id: number,
  datos: { nomina?: string; es_activo?: boolean; requiere_codig?: boolean },
) {
  return conAuditoria("actualizarNominaAction", async () => {
    const res = await reglasCatalogosApi.actualizarNomina(id, datos);
    return res.data;
  });
}

export async function crearNominaAction(
  nomina: string,
  es_activo: boolean,
  requiere_codig: boolean,
) {
  return conAuditoria("crearNominaAction", async () => {
    const res = await reglasCatalogosApi.crearNomina(nomina, es_activo, requiere_codig);
    return res.data;
  });
}

export async function eliminarNominaAction(id: number) {
  return conAuditoria("eliminarNominaAction", async () => {
    const res = await reglasCatalogosApi.eliminarNomina(id);
    return res.data;
  });
}

export async function crearPaisAction(nombre: string, codigo: string) {
  return conAuditoria("crearPaisAction", async () => {
    const res = await reglasCatalogosApi.crearPais(nombre, codigo);
    return res.data;
  });
}

export async function actualizarPaisAction(
  id: number,
  datos: { nombre?: string; codigo?: string },
) {
  return conAuditoria("actualizarPaisAction", async () => {
    const res = await reglasCatalogosApi.actualizarPais(id, datos);
    return res.data;
  });
}

export async function eliminarPaisAction(id: number) {
  return conAuditoria("eliminarPaisAction", async () => {
    const res = await reglasCatalogosApi.eliminarPais(id);
    return res.data;
  });
}

export async function crearTipoSoporteAction(
  codigo: string,
  nombre: string,
  orden: number,
) {
  return conAuditoria("crearTipoSoporteAction", async () => {
    const res = await reglasCatalogosApi.crearTipoSoporte({ codigo, nombre, orden });
    return res.data;
  });
}

export async function actualizarTipoSoporteAction(
  id: number,
  datos: { codigo?: string; nombre?: string; orden?: number },
) {
  return conAuditoria("actualizarTipoSoporteAction", async () => {
    const res = await reglasCatalogosApi.actualizarTipoSoporte(id, datos);
    return res.data;
  });
}

export async function eliminarTipoSoporteAction(id: number) {
  return conAuditoria("eliminarTipoSoporteAction", async () => {
    const res = await reglasCatalogosApi.eliminarTipoSoporte(id);
    return res.data;
  });
}

export async function reordenarTiposSoporteAction(ordenes: { id: number; orden: number }[]) {
  return conAuditoria("reordenarTiposSoporteAction", async () => {
    const res = await reglasCatalogosApi.reordenarTiposSoporte(ordenes);
    return res.data;
  });
}

export async function actualizarChecklistSoporteAction(
  seccion: string,
  tipos: { tipo_soporte_id: number; permitido: boolean; requerido: boolean }[],
) {
  return conAuditoria("actualizarChecklistSoporteAction", async () => {
    const res = await reglasCatalogosApi.actualizarChecklistSoporte(seccion, tipos);
    return res.data;
  });
}
