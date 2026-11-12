"use server";

import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { errorDeAccion, handleSessionExpired } from "@/shared/infrastructure/http/errors";
import { mensajeErrorCredencial } from "../../application/etiquetar-errores-credencial";
import {
  credencialesExternasApi,
  type CrearCredencialExternaApiInput,
  type GrupoCredencial,
} from "../http/credenciales-externas-api";

type Filtros = { tipo?: string; estado?: string; desde?: string; hasta?: string };

export async function getCredencialesExternasAction(grupo: GrupoCredencial, filtros?: Filtros) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await credencialesExternasApi.listar(grupo, filtros);
    await logAudit({ traceId, action: "getCredencialesExternasAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCredencialesExternasAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible cargar las credenciales.");
  }
}

export async function crearCredencialExternaAction(
  grupo: GrupoCredencial,
  datos: CrearCredencialExternaApiInput,
) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await credencialesExternasApi.crear(grupo, datos);
    await logAudit({ traceId, action: "crearCredencialExternaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "crearCredencialExternaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const r = errorDeAccion(error, "No fue posible emitir la credencial.");
    return { ...r, error: mensajeErrorCredencial(r, grupo === "temporal") };
  }
}

export async function devolverCredencialExternaAction(id: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await credencialesExternasApi.devolver(id);
    await logAudit({ traceId, action: "devolverCredencialExternaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "devolverCredencialExternaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible registrar la devolución.");
  }
}

export async function anularCredencialExternaAction(id: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await credencialesExternasApi.anular(id);
    await logAudit({ traceId, action: "anularCredencialExternaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "anularCredencialExternaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible anular la credencial.");
  }
}

export async function descargarCredencialPdfAction(id: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await credencialesExternasApi.pdf(id);
    await logAudit({ traceId, action: "descargarCredencialPdfAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "descargarCredencialPdfAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible generar el PDF.");
  }
}

export async function generarLoteCredencialesPdfAction(ids: string[]) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await credencialesExternasApi.lotePdf(ids);
    await logAudit({ traceId, action: "generarLoteCredencialesPdfAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "generarLoteCredencialesPdfAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible generar el lote.");
  }
}

export async function enviarCredencialExternaAction(id: string, destinatario?: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await credencialesExternasApi.enviar(id, destinatario);
    await logAudit({ traceId, action: "enviarCredencialExternaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "enviarCredencialExternaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible encolar el correo.");
  }
}
