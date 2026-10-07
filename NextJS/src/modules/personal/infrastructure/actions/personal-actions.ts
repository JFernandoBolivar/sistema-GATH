"use server";

/**
 * Server Actions para Personal (Regla R7).
 * Zero-trust: se revalida la entrada con el schema Zod antes de invocar el
 * caso de uso. Captura errores y llama `handleSessionExpired` (R7) y registra
 * la auditoría en `logs/frontend/audit_frontend.txt` (D-04/C-5).
 *
 * El cambio de condición laboral (activo → pasivo) no tiene todavía un
 * endpoint real en el backend — ver Fase 2.1 del plan de reparación
 * (`PLAN_REPARACION_GATH.md`). No se expone una acción para eso aquí hasta
 * que ese flujo exista, para no llamar una ruta inexistente.
 */
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import type { FiltrosListadoEmpleado } from "../../domain/ports/repo-personal";
import type { GuardarEmpleadoInputDTO } from "../../application/dtos/empleado-dto";
import {
  actualizarEmpleado,
  registrarEmpleado,
} from "../../application/use-cases/gestionar-empleado";
import {
  listarEmpleados,
  obtenerEmpleadoPorCedula,
} from "../../application/use-cases/listar-empleados";
import { listarCatalogosExpediente } from "../../application/use-cases/listar-catalogos-expediente";
import { repoPersonalApi } from "../repositories/repo-personal-api";
import { personalApi } from "../http/personal-api";
import {
  empleadoCedulaSchema,
  empleadoRegistroSchema,
  empleadoSchema,
  listadoEmpleadosSchema,
} from "../../ui/schema/schema-empleado";

export async function getEmpleadosAction(filtros?: FiltrosListadoEmpleado) {
  const validated = listadoEmpleadosSchema.safeParse(filtros ?? {});
  const filtrosValidos = validated.success ? validated.data : {};

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarEmpleados(repoPersonalApi, filtrosValidos);
    await logAudit({ traceId, action: "getEmpleadosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getEmpleadosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getEmpleadoPorCedulaAction(cedula: string) {
  const validation = empleadoCedulaSchema.safeParse({ cedula });
  if (!validation.success) {
    return { error: "Cédula inválida. Revise el formato ingresado." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await obtenerEmpleadoPorCedula(repoPersonalApi, validation.data.cedula);
    await logAudit({ traceId, action: "getEmpleadoPorCedulaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getEmpleadoPorCedulaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const mensaje = error instanceof Error && error.message ? error.message : "Empleado no encontrado";
    return { error: mensaje };
  }
}

export async function registrarEmpleadoAction(input: GuardarEmpleadoInputDTO) {
  const validation = empleadoRegistroSchema.safeParse(input);
  if (!validation.success) {
    const detalle = validation.error.issues[0]?.message;
    return { error: `Datos del empleado inválidos${detalle ? `: ${detalle}` : ". Revise los campos ingresados."}` };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await registrarEmpleado(repoPersonalApi, validation.data);
    await logAudit({ traceId, action: "registrarEmpleadoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "registrarEmpleadoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    // Se devuelve (no se relanza) para que el wizard muestre en el toast el
    // mensaje real del backend: Next oculta el mensaje de los errores lanzados
    // desde Server Actions en producción.
    const mensaje = error instanceof Error && error.message ? error.message : "Error al registrar empleado";
    return { error: mensaje };
  }
}

export async function actualizarEmpleadoAction(
  cedula: string,
  data: Partial<GuardarEmpleadoInputDTO>
) {
  const cedulaValida = empleadoCedulaSchema.safeParse({ cedula });
  const dataValida = empleadoSchema.partial().safeParse(data);
  if (!cedulaValida.success || !dataValida.success) {
    return { error: "Datos del empleado inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await actualizarEmpleado(repoPersonalApi, cedulaValida.data.cedula, dataValida.data);
    await logAudit({ traceId, action: "actualizarEmpleadoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "actualizarEmpleadoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const mensaje = error instanceof Error && error.message ? error.message : "Error al actualizar empleado";
    return { error: mensaje };
  }
}

export async function subirFotoEmpleadoAction(cedula: string, formData: FormData) {
  const validation = empleadoCedulaSchema.safeParse({ cedula });
  if (!validation.success) {
    return { error: "Cédula inválida. Revise el formato ingresado." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const { personalApi } = await import("../http/personal-api");
    const result = await personalApi.subirFoto(validation.data.cedula, formData);
    await logAudit({ traceId, action: "subirFotoEmpleadoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "subirFotoEmpleadoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getCatalogosExpedienteAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCatalogosExpediente(repoPersonalApi);
    await logAudit({ traceId, action: "getCatalogosExpedienteAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCatalogosExpedienteAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getTiposNominaAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await personalApi.getTiposNomina();
    await logAudit({ traceId, action: "getTiposNominaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getTiposNominaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

/** PDF del expediente generado en backend (ReportLab); reemplaza el render client-side con @react-pdf/renderer. */
export async function descargarEmpleadoPdfAction(cedula: string) {
  const validation = empleadoCedulaSchema.safeParse({ cedula });
  if (!validation.success) {
    return { error: "Cédula inválida." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const resultado = await repoPersonalApi.descargarPdf(validation.data.cedula);
    await logAudit({ traceId, action: "descargarEmpleadoPdfAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return resultado;
  } catch (error) {
    await logAudit({ traceId, action: "descargarEmpleadoPdfAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

