"use server";

/**
 * Server Actions para Cargos (Regla R7).
 * Zero-trust: se revalida la entrada con el schema Zod antes de invocar el
 * caso de uso. Captura errores y llama `handleSessionExpired` (R7) y registra
 * la auditoría en `logs/frontend/audit_frontend.txt` (D-04/C-5).
 */
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import {
  asignarCargo,
  cambiarCargo,
  desasignarCargo,
  gestionarEstatus,
} from "../../application/use-cases/asignar-cargo";
import { crearCargo } from "../../application/use-cases/crear-cargo";
import {
  listarCargos,
  listarCoordinaciones,
  listarDependencias,
  listarDenominaciones,
  listarDenominacionesEspecificas,
  listarDireccionesGenerales,
  listarDireccionesLinea,
  listarEstatusCargo,
  listarGrados,
  listarMotivos,
  listarOrganismosAdscritos,
  listarTiposNomina,
} from "../../application/use-cases/listar-cargos";
import {
  crearPrestamo,
  finalizarPrestamo,
  listarPrestamos,
} from "../../application/use-cases/prestamo-cargo";
import {
  actualizarDenominacion,
  actualizarDenominacionEspecifica,
  crearDenominacion,
  crearDenominacionEspecifica,
  eliminarDenominacion,
  eliminarDenominacionEspecifica,
} from "../../application/use-cases/gestionar-denominaciones";
import { repoCargosApi } from "../repositories/repo-cargos-api";
import {
  asignarCargoSchema,
  cargoIdSchema,
  cargosFiltroSchema,
  cambiarCargoSchema,
  crearCargoSchema,
  crearPrestamoSchema,
  denominacionIdSchema,
  denominacionSchema,
  gestionarEstatusSchema,
  prestamoIdSchema,
} from "../../ui/schema/schema-asignar-cargo";

export async function getCargosAction(filtros?: { dependenciaId?: number; soloVacantes?: boolean }) {
  const validated = cargosFiltroSchema.safeParse(filtros ?? {});
  const filtrosValidos = validated.success ? validated.data : {};

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCargos(repoCargosApi, {
      dependenciaId: filtrosValidos.dependenciaId ?? undefined,
      soloVacantes: filtrosValidos.soloVacantes,
    });
    await logAudit({ traceId, action: "getCargosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCargosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getDenominacionesAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarDenominaciones(repoCargosApi);
    await logAudit({ traceId, action: "getDenominacionesAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getDenominacionesAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getDenominacionesEspecificasAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarDenominacionesEspecificas(repoCargosApi);
    await logAudit({ traceId, action: "getDenominacionesEspecificasAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getDenominacionesEspecificasAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getMotivosAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarMotivos(repoCargosApi);
    await logAudit({ traceId, action: "getMotivosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getMotivosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getEstatusAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarEstatusCargo(repoCargosApi);
    await logAudit({ traceId, action: "getEstatusAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getEstatusAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function asignarCargoAction(cargoId: number, empleadoCedula: string) {
  const validation = asignarCargoSchema.safeParse({ cargoId, empleadoCedula });
  if (!validation.success) {
    return { error: "Datos de asignación inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await asignarCargo(repoCargosApi, validation.data.cargoId, validation.data.empleadoCedula);
    await logAudit({ traceId, action: "asignarCargoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "asignarCargoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function desasignarCargoAction(cargoId: number) {
  const validation = cargoIdSchema.safeParse({ cargoId });
  if (!validation.success) {
    return { error: "Debe seleccionar un cargo válido." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await desasignarCargo(repoCargosApi, validation.data.cargoId);
    await logAudit({ traceId, action: "desasignarCargoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "desasignarCargoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function cambiarCargoAction(input: { cargoActualId: number; cargoNuevoId: number; motivoId: number }) {
  const validation = cambiarCargoSchema.safeParse(input);
  if (!validation.success) {
    return { error: "Datos del traslado inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await cambiarCargo(repoCargosApi, validation.data);
    await logAudit({ traceId, action: "cambiarCargoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "cambiarCargoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function gestionarEstatusAction(input: { cargoId: number; estatusId: number; motivoId: number }) {
  const validation = gestionarEstatusSchema.safeParse(input);
  if (!validation.success) {
    return { error: "Datos de estatus inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await gestionarEstatus(repoCargosApi, validation.data);
    await logAudit({ traceId, action: "gestionarEstatusAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "gestionarEstatusAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getPrestamosAction(soloActivos?: boolean) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarPrestamos(repoCargosApi, soloActivos);
    await logAudit({ traceId, action: "getPrestamosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getPrestamosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function crearPrestamoAction(input: {
  cedulaEncargado: string;
  cargoId: number;
  motivoId: number;
  fechaInicio: string;
  fechaFin: string;
}) {
  const validation = crearPrestamoSchema.safeParse(input);
  if (!validation.success) {
    return { error: "Datos del préstamo inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await crearPrestamo(repoCargosApi, validation.data);
    await logAudit({ traceId, action: "crearPrestamoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "crearPrestamoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function finalizarPrestamoAction(prestamoId: number) {
  const validation = prestamoIdSchema.safeParse({ prestamoId });
  if (!validation.success) {
    return { error: "Préstamo inválido." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await finalizarPrestamo(repoCargosApi, validation.data.prestamoId);
    await logAudit({ traceId, action: "finalizarPrestamoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "finalizarPrestamoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function crearDenominacionAction(input: { nombre: string; orden: number }) {
  const validation = denominacionSchema.safeParse(input);
  if (!validation.success) {
    return { error: "Datos de la denominación inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await crearDenominacion(repoCargosApi, validation.data);
    await logAudit({ traceId, action: "crearDenominacionAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "crearDenominacionAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function actualizarDenominacionAction(id: number, input: { nombre: string; orden: number }) {
  const idValido = denominacionIdSchema.safeParse({ denominacionId: id });
  const dataValida = denominacionSchema.safeParse(input);
  if (!idValido.success || !dataValida.success) {
    return { error: "Datos de la denominación inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await actualizarDenominacion(repoCargosApi, idValido.data.denominacionId, dataValida.data);
    await logAudit({ traceId, action: "actualizarDenominacionAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "actualizarDenominacionAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function eliminarDenominacionAction(denominacionId: number) {
  const validation = denominacionIdSchema.safeParse({ denominacionId });
  if (!validation.success) {
    return { error: "Denominación inválida." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarDenominacion(repoCargosApi, validation.data.denominacionId);
    await logAudit({ traceId, action: "eliminarDenominacionAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarDenominacionAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function crearDenominacionEspecificaAction(input: { nombre: string; orden: number }) {
  const validation = denominacionSchema.safeParse(input);
  if (!validation.success) {
    return { error: "Datos de la denominación específica inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await crearDenominacionEspecifica(repoCargosApi, validation.data);
    await logAudit({ traceId, action: "crearDenominacionEspecificaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "crearDenominacionEspecificaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function actualizarDenominacionEspecificaAction(id: number, input: { nombre: string; orden: number }) {
  const idValido = denominacionIdSchema.safeParse({ denominacionId: id });
  const dataValida = denominacionSchema.safeParse(input);
  if (!idValido.success || !dataValida.success) {
    return { error: "Datos de la denominación específica inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await actualizarDenominacionEspecifica(repoCargosApi, idValido.data.denominacionId, dataValida.data);
    await logAudit({ traceId, action: "actualizarDenominacionEspecificaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "actualizarDenominacionEspecificaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function eliminarDenominacionEspecificaAction(denominacionId: number) {
  const validation = denominacionIdSchema.safeParse({ denominacionId });
  if (!validation.success) {
    return { error: "Denominación específica inválida." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarDenominacionEspecifica(repoCargosApi, validation.data.denominacionId);
    await logAudit({ traceId, action: "eliminarDenominacionEspecificaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarDenominacionEspecificaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function crearCargoAction(input: {
  denominacionId: number;
  especificaId: number;
  tipoNominaId: number;
  dependenciaId?: number;
  direccionGeneralId?: number;
  direccionLineaId?: number;
  coordinacionId?: number;
  organismoId?: number;
  gradoId?: number;
  observaciones?: string;
}) {
  const validation = crearCargoSchema.safeParse(input);
  if (!validation.success) {
    return { error: "Datos del código inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await crearCargo(repoCargosApi, validation.data);
    await logAudit({ traceId, action: "crearCargoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "crearCargoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getTiposNominaAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarTiposNomina(repoCargosApi);
    await logAudit({ traceId, action: "getTiposNominaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getTiposNominaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getGradosAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarGrados(repoCargosApi);
    await logAudit({ traceId, action: "getGradosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getGradosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getOrganismosAdscritosAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarOrganismosAdscritos(repoCargosApi);
    await logAudit({ traceId, action: "getOrganismosAdscritosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getOrganismosAdscritosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getDependenciasAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarDependencias(repoCargosApi);
    await logAudit({ traceId, action: "getDependenciasAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getDependenciasAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getDireccionesGeneralesAction(dependenciaId?: number) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarDireccionesGenerales(repoCargosApi, dependenciaId);
    await logAudit({ traceId, action: "getDireccionesGeneralesAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getDireccionesGeneralesAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getDireccionesLineaAction(direccionGeneralId?: number) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarDireccionesLinea(repoCargosApi, direccionGeneralId);
    await logAudit({ traceId, action: "getDireccionesLineaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getDireccionesLineaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getCoordinacionesAction(direccionLineaId?: number) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCoordinaciones(repoCargosApi, direccionLineaId);
    await logAudit({ traceId, action: "getCoordinacionesAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCoordinacionesAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}
