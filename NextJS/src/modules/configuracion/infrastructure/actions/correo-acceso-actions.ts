/**
 * Server Actions para Política de Correo de Acceso y Aplicación Masiva (A7).
 */
"use server";

import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { errorDeAccion, handleSessionExpired } from "@/shared/infrastructure/http/errors";
import { correoAccesoApi } from "../http/correo-acceso-api";
import type {
  AplicarPoliticaMasivaRequestDTO,
  PoliticaCorreoAccesoDTO,
} from "../../application/dtos/correo-acceso-dto";

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
    return errorDeAccion(
      error,
      "No fue posible completar la operación de correo de acceso.",
    );
  }
}

export async function obtenerPoliticaCorreoAccesoAction() {
  return conAuditoria("obtenerPoliticaCorreoAccesoAction", async () => {
    const res = await correoAccesoApi.obtenerPolitica();
    return res.data;
  });
}

export async function actualizarPoliticaCorreoAccesoAction(
  datos: PoliticaCorreoAccesoDTO,
) {
  return conAuditoria("actualizarPoliticaCorreoAccesoAction", async () => {
    const res = await correoAccesoApi.actualizarPolitica(datos);
    return res.data;
  });
}

export async function obtenerVistaPreviaCorreoAccesoAction(
  grupo: "activos" | "pasivos",
  incluirExcepciones: boolean = false,
) {
  return conAuditoria("obtenerVistaPreviaCorreoAccesoAction", async () => {
    const res = await correoAccesoApi.obtenerVistaPrevia(grupo, incluirExcepciones);
    return res.data;
  });
}

export async function aplicarPoliticaCorreoAccesoMasivoAction(
  datos: AplicarPoliticaMasivaRequestDTO,
) {
  return conAuditoria("aplicarPoliticaCorreoAccesoMasivoAction", async () => {
    const res = await correoAccesoApi.aplicarMasivo(datos);
    return res.data;
  });
}

export async function descargarExcelVistaPreviaCorreoAccesoAction(
  grupo: "activos" | "pasivos",
  incluirExcepciones: boolean = false,
) {
  return conAuditoria("descargarExcelVistaPreviaCorreoAccesoAction", async () => {
    const blob = await correoAccesoApi.descargarExcelVistaPrevia(grupo, incluirExcepciones);
    const arrayBuffer = await blob.arrayBuffer();
    return {
      base64: Buffer.from(arrayBuffer).toString("base64"),
      nombre: `vista_previa_correo_${grupo}.xlsx`,
    };
  });
}
