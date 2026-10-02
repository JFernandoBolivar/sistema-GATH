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
  asignarCargoEspecial,
  cambiarCargo,
  desasignarCargo,
  gestionarEstatus,
} from "../../application/use-cases/asignar-cargo";
import { crearCargo } from "../../application/use-cases/crear-cargo";
import { actualizarCargo } from "../../application/use-cases/actualizar-cargo";
import { schemaUpdateCodeTable, type UpdateCodeTable } from "../../ui/schema/schema-update-code";
import { cargosApi } from "../http/cargos-api";
import type { CrearCargoEspecialInputDTO } from "../../application/dtos/cargo-dto";
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

export async function getCargosAction(filtros?: {
  dependenciaId?: number | null;
  tipoNominaId?: number | null;
  direccionGeneralId?: number | null;
  direccionLineaId?: number | null;
  coordinacionId?: number | null;
  codigo?: string | null;
  soloVacantes?: boolean;
}) {
  const validated = cargosFiltroSchema.safeParse(filtros ?? {});
  const filtrosValidos = validated.success ? validated.data : {};

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCargos(repoCargosApi, {
      dependenciaId: filtrosValidos.dependenciaId ?? undefined,
      tipoNominaId: filtrosValidos.tipoNominaId ?? undefined,
      direccionGeneralId: filtrosValidos.direccionGeneralId ?? undefined,
      direccionLineaId: filtrosValidos.direccionLineaId ?? undefined,
      coordinacionId: filtrosValidos.coordinacionId ?? undefined,
      codigo: filtrosValidos.codigo || undefined,
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

export async function getCargosVacantesAction(filtros?: {
  dependenciaId?: number;
  tipoNominaId?: number;
  direccionGeneralId?: number;
  direccionLineaId?: number;
  coordinacionId?: number;
  codigo?: string;
}) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCargos(repoCargosApi, {
      ...filtros,
      soloVacantes: true,
    });
    await logAudit({ traceId, action: "getCargosVacantesAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCargosVacantesAction", status: "FAILED", durationMs: Date.now() - startedAt });
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

export async function getMotivosAction(categoria?: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarMotivos(repoCargosApi, categoria);
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
  } catch (error: unknown) {
    await logAudit({ traceId, action: "asignarCargoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Ocurrió un error al asignar el puesto.";
    return { error: msg };
  }
}

export async function asignarCargoEspecialAction(input: CrearCargoEspecialInputDTO) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await asignarCargoEspecial(repoCargosApi, input);
    await logAudit({ traceId, action: "asignarCargoEspecialAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Cargo especial asignado correctamente.", data: result };
  } catch (error: unknown) {
    await logAudit({ traceId, action: "asignarCargoEspecialAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Ocurrió un error al asignar el cargo especial.";
    return { success: false, message: msg };
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

export async function getPrestamosAction(soloActivos?: boolean, empleado?: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarPrestamos(repoCargosApi, soloActivos, empleado);
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

export async function registrarEncargaduriaAction(input: {
  cargo_encargado: number;
  empleado_encargado: string;
  motivo: number;
  nueva_motivo_nombre?: string;
  fecha_inicio: string;
  fecha_fin: string;
}) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    let motivoId = input.motivo;
    if (input.motivo === -1 && input.nueva_motivo_nombre?.trim()) {
      const nuevoMotivo = await cargosApi.crearMotivo(input.nueva_motivo_nombre.trim(), "ENCARGADURIA");
      motivoId = nuevoMotivo.id;
    }
    const result = await crearPrestamo(repoCargosApi, {
      cedulaEncargado: input.empleado_encargado,
      cargoId: input.cargo_encargado,
      motivoId,
      fechaInicio: input.fecha_inicio,
      fechaFin: input.fecha_fin,
    });
    await logAudit({ traceId, action: "registrarEncargaduriaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Encargaduría registrada exitosamente.", data: result };
  } catch (error: unknown) {
    await logAudit({ traceId, action: "registrarEncargaduriaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Ocurrió un error al registrar la encargaduría.";
    return { success: false, message: msg };
  }
}

export async function finalizarPrestamoAction(prestamoId: number, fechaFin?: string) {
  const validation = prestamoIdSchema.safeParse({ prestamoId });
  if (!validation.success) {
    return { success: false, message: "Préstamo inválido." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await finalizarPrestamo(repoCargosApi, validation.data.prestamoId, fechaFin);
    await logAudit({ traceId, action: "finalizarPrestamoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Encargaduría finalizada exitosamente.", data: result };
  } catch (error: unknown) {
    await logAudit({ traceId, action: "finalizarPrestamoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Ocurrió un error al finalizar la encargaduría.";
    return { success: false, message: msg };
  }
}

export async function crearMotivoAction(movimiento: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await cargosApi.crearMotivo(movimiento);
    await logAudit({ traceId, action: "crearMotivoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, data: result };
  } catch (error: unknown) {
    await logAudit({ traceId, action: "crearMotivoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al crear motivo.";
    return { success: false, message: msg };
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

export async function actualizarCargoAction(cargoId: number, input: UpdateCodeTable) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const validatedId = cargoIdSchema.parse({ cargoId });
    const validatedInput = schemaUpdateCodeTable.parse(input);
    const result = await actualizarCargo(repoCargosApi, validatedId.cargoId, validatedInput);
    await logAudit({ traceId, action: "actualizarCargoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Cargo actualizado correctamente", data: result };
  } catch (error: unknown) {
    await logAudit({ traceId, action: "actualizarCargoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const message = error instanceof Error ? error.message : "Error al actualizar el cargo";
    return { success: false, message };
  }
}
