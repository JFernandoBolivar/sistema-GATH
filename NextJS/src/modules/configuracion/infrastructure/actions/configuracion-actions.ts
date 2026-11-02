"use server";

/**
 * Server Actions de Configuración Visual (Regla R7).
 * Zero-trust: se revalida la entrada con el schema Zod antes de invocar el
 * caso de uso. Captura errores y llama `handleSessionExpired`.
 */
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import type { ActualizarConfiguracionVisualInputDTO } from "../../application/dtos/configuracion-visual-dto";
import {
  actualizarConfiguracionVisual,
  obtenerConfiguracionVisual,
  subirLogoConfiguracion,
} from "../../application/use-cases/gestionar-configuracion-visual";
import { repoConfiguracionVisualApi } from "../repositories/repo-configuracion-visual-api";
import { actualizarConfiguracionVisualSchema, campoLogoSchema } from "../../ui/schema/schema-configuracion-visual";

const TAMANO_MAXIMO_LOGO_BYTES = 5 * 1024 * 1024; // 5MB, mismo límite que el resto de subidas del sistema.

export async function getConfiguracionVisualAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await obtenerConfiguracionVisual(repoConfiguracionVisualApi);
    await logAudit({ traceId, action: "getConfiguracionVisualAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getConfiguracionVisualAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function actualizarConfiguracionVisualAction(input: ActualizarConfiguracionVisualInputDTO) {
  const validation = actualizarConfiguracionVisualSchema.safeParse(input);
  if (!validation.success) {
    return { error: "Datos de configuración inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await actualizarConfiguracionVisual(repoConfiguracionVisualApi, validation.data);
    await logAudit({ traceId, action: "actualizarConfiguracionVisualAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "actualizarConfiguracionVisualAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return { error: error instanceof Error && error.message ? error.message : "No fue posible actualizar la configuración." };
  }
}

export async function subirLogoConfiguracionAction(campo: string, archivo: File) {
  const validacionCampo = campoLogoSchema.safeParse(campo);
  if (!validacionCampo.success) {
    return { error: `Imagen inválida: ${campo}.` };
  }
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Seleccione un archivo válido." };
  }
  if (archivo.size > TAMANO_MAXIMO_LOGO_BYTES) {
    return { error: "El tamaño máximo de la imagen es 5MB." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await subirLogoConfiguracion(repoConfiguracionVisualApi, validacionCampo.data, archivo);
    await logAudit({ traceId, action: "subirLogoConfiguracionAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "subirLogoConfiguracionAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return { error: error instanceof Error && error.message ? error.message : "No fue posible subir la imagen." };
  }
}
