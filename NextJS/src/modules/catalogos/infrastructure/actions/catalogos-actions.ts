"use server";

/**
 * Server Actions para Catálogos (Regla R7).
 * Zero-trust: se revalida la entrada con el schema Zod antes de invocar el
 * caso de uso. Captura errores y llama `handleSessionExpired` (R7) y registra
 * la auditoría en `logs/frontend/audit_frontend.txt` (D-04/C-5).
 */
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import {
  listarEstatus,
  listarEstados,
  listarGrados,
  listarMunicipios,
  listarParentescos,
  listarParroquias,
  listarRegiones,
  listarSexos,
  listarTiposNomina,
  listarTiposPersonal,
  listarTiposProcedencia,
  listarCategoriasMovimiento,
  listarTiposMovimiento,
  listarEstadosCiviles,
  listarPoliticas,
  listarCondicionesVivienda,
  listarCodigosPostales,
  listarGruposSanguineos,
  listarNivelesAcademicos,
  listarCarreras,
  listarMenciones,
  listarInstituciones,
  listarTiposPrenda,
  listarRegionesTalla,
  listarTallas,
  listarCapacitaciones,
  listarGruposCapacitacion,
  listarAlergias,
  listarPatologias,
  listarDiscapacidades,
} from "../../application/use-cases/listar-catalogos";
import {
  crearAlergia,
  eliminarAlergia,
  listarCategoriasAlergia,
  crearCategoriaAlergia,
  eliminarCategoriaAlergia,
  crearPatologia,
  eliminarPatologia,
  listarCategoriasPatologia,
  crearCategoriaPatologia,
  eliminarCategoriaPatologia,
  crearDiscapacidad,
  eliminarDiscapacidad,
  listarCategoriasDiscapacidad,
  crearCategoriaDiscapacidad,
  eliminarCategoriaDiscapacidad,
  crearTalla,
  eliminarTalla,
  crearRegionTalla,
  eliminarRegionTalla,
  crearTipoPrenda,
  eliminarTipoPrenda,
} from "../../application/use-cases/gestionar-catalogos";
import { repoCatalogosApi } from "../repositories/repo-catalogos-api";
import {
  crearAlergiaSchema,
  crearCategoriaSchema,
  crearDiscapacidadSchema,
  crearPatologiaSchema,
  crearRegionTallaSchema,
  crearTallaSchema,
  crearTipoPrendaSchema,
  eliminarItemSchema,
  idPadreFiltroSchema,
} from "../../ui/schema/schema-catalogos";

export async function getRegionesAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarRegiones(repoCatalogosApi);
    await logAudit({ traceId, action: "getRegionesAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getRegionesAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getEstadosAction(regionId?: number) {
  const validated = idPadreFiltroSchema.safeParse({ idPadre: regionId });
  const idPadre = validated.success ? validated.data.idPadre ?? undefined : undefined;

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarEstados(repoCatalogosApi, idPadre);
    await logAudit({ traceId, action: "getEstadosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getEstadosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getMunicipiosAction(estadoId?: number) {
  const validated = idPadreFiltroSchema.safeParse({ idPadre: estadoId });
  const idPadre = validated.success ? validated.data.idPadre ?? undefined : undefined;

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarMunicipios(repoCatalogosApi, idPadre);
    await logAudit({ traceId, action: "getMunicipiosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getMunicipiosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getParroquiasAction(municipioId?: number) {
  const validated = idPadreFiltroSchema.safeParse({ idPadre: municipioId });
  const idPadre = validated.success ? validated.data.idPadre ?? undefined : undefined;

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarParroquias(repoCatalogosApi, idPadre);
    await logAudit({ traceId, action: "getParroquiasAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getParroquiasAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getSexosAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarSexos(repoCatalogosApi);
    await logAudit({ traceId, action: "getSexosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getSexosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getEstatusAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarEstatus(repoCatalogosApi);
    await logAudit({ traceId, action: "getEstatusAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getEstatusAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getTiposPersonalAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarTiposPersonal(repoCatalogosApi);
    await logAudit({ traceId, action: "getTiposPersonalAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getTiposPersonalAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getTiposNominaAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarTiposNomina(repoCatalogosApi);
    await logAudit({ traceId, action: "getTiposNominaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getTiposNominaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getParentescosAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarParentescos(repoCatalogosApi);
    await logAudit({ traceId, action: "getParentescosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getParentescosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getTiposProcedenciaAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarTiposProcedencia(repoCatalogosApi);
    await logAudit({ traceId, action: "getTiposProcedenciaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getTiposProcedenciaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getGradosAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarGrados(repoCatalogosApi);
    await logAudit({ traceId, action: "getGradosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getGradosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getCategoriasMovimientoAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCategoriasMovimiento(repoCatalogosApi);
    await logAudit({ traceId, action: "getCategoriasMovimientoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCategoriasMovimientoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getTiposMovimientoAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarTiposMovimiento(repoCatalogosApi);
    await logAudit({ traceId, action: "getTiposMovimientoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getTiposMovimientoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getEstadosCivilesAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarEstadosCiviles(repoCatalogosApi);
    await logAudit({ traceId, action: "getEstadosCivilesAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getEstadosCivilesAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getPoliticasAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarPoliticas(repoCatalogosApi);
    await logAudit({ traceId, action: "getPoliticasAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getPoliticasAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getCondicionesViviendaAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCondicionesVivienda(repoCatalogosApi);
    await logAudit({ traceId, action: "getCondicionesViviendaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCondicionesViviendaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getCodigosPostalesAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCodigosPostales(repoCatalogosApi);
    await logAudit({ traceId, action: "getCodigosPostalesAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCodigosPostalesAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getGruposSanguineosAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarGruposSanguineos(repoCatalogosApi);
    await logAudit({ traceId, action: "getGruposSanguineosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getGruposSanguineosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getNivelesAcademicosAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarNivelesAcademicos(repoCatalogosApi);
    await logAudit({ traceId, action: "getNivelesAcademicosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getNivelesAcademicosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getCarrerasAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCarreras(repoCatalogosApi);
    await logAudit({ traceId, action: "getCarrerasAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCarrerasAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getMencionesAction(carreraId?: number) {
  const validated = idPadreFiltroSchema.safeParse({ idPadre: carreraId });
  const id = validated.success ? validated.data.idPadre ?? undefined : undefined;

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarMenciones(repoCatalogosApi, id);
    await logAudit({ traceId, action: "getMencionesAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getMencionesAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getInstitucionesAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarInstituciones(repoCatalogosApi);
    await logAudit({ traceId, action: "getInstitucionesAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getInstitucionesAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getTiposPrendaAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarTiposPrenda(repoCatalogosApi);
    await logAudit({ traceId, action: "getTiposPrendaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getTiposPrendaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getRegionesTallaAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarRegionesTalla(repoCatalogosApi);
    await logAudit({ traceId, action: "getRegionesTallaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getRegionesTallaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getTallasAction(tipoPrendaId?: number) {
  const validated = idPadreFiltroSchema.safeParse({ idPadre: tipoPrendaId });
  const id = validated.success ? validated.data.idPadre ?? undefined : undefined;

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarTallas(repoCatalogosApi, id);
    await logAudit({ traceId, action: "getTallasAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getTallasAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getCapacitacionesAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCapacitaciones(repoCatalogosApi);
    await logAudit({ traceId, action: "getCapacitacionesAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCapacitacionesAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getGruposCapacitacionAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarGruposCapacitacion(repoCatalogosApi);
    await logAudit({ traceId, action: "getGruposCapacitacionAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getGruposCapacitacionAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getAlergiasAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarAlergias(repoCatalogosApi);
    await logAudit({ traceId, action: "getAlergiasAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getAlergiasAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getPatologiasAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarPatologias(repoCatalogosApi);
    await logAudit({ traceId, action: "getPatologiasAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getPatologiasAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getDiscapacidadesAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarDiscapacidades(repoCatalogosApi);
    await logAudit({ traceId, action: "getDiscapacidadesAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getDiscapacidadesAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

// ----------------------------------------------------------------------
// Server Actions para CRUD de Catálogos de Soporte (Zero-trust R7)
// ----------------------------------------------------------------------

// Alergias
export async function crearAlergiaAction(datos: unknown) {
  const parsed = crearAlergiaSchema.safeParse(datos);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const item = await crearAlergia(repoCatalogosApi, parsed.data);
    await logAudit({ traceId, action: "crearAlergiaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Alergia creada exitosamente.", item };
  } catch (error) {
    await logAudit({ traceId, action: "crearAlergiaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al crear alergia";
    return { success: false, message: msg };
  }
}

export async function eliminarAlergiaAction(datos: unknown) {
  const parsed = eliminarItemSchema.safeParse(datos);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarAlergia(repoCatalogosApi, parsed.data.id);
    await logAudit({ traceId, action: "eliminarAlergiaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Alergia eliminada exitosamente." };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarAlergiaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al eliminar alergia";
    return { success: false, message: msg };
  }
}

export async function getCategoriasAlergiaAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCategoriasAlergia(repoCatalogosApi);
    await logAudit({ traceId, action: "getCategoriasAlergiaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCategoriasAlergiaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function crearCategoriaAlergiaAction(datos: unknown) {
  const parsed = crearCategoriaSchema.safeParse(datos);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const item = await crearCategoriaAlergia(repoCatalogosApi, parsed.data);
    await logAudit({ traceId, action: "crearCategoriaAlergiaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Categoría de alergia creada exitosamente.", item };
  } catch (error) {
    await logAudit({ traceId, action: "crearCategoriaAlergiaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al crear categoría";
    return { success: false, message: msg };
  }
}

export async function eliminarCategoriaAlergiaAction(datos: unknown) {
  const parsed = eliminarItemSchema.safeParse(datos);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarCategoriaAlergia(repoCatalogosApi, parsed.data.id);
    await logAudit({ traceId, action: "eliminarCategoriaAlergiaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Categoría de alergia eliminada." };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarCategoriaAlergiaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al eliminar categoría";
    return { success: false, message: msg };
  }
}

// Patologías
export async function crearPatologiaAction(datos: unknown) {
  const parsed = crearPatologiaSchema.safeParse(datos);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const item = await crearPatologia(repoCatalogosApi, parsed.data);
    await logAudit({ traceId, action: "crearPatologiaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Patología creada exitosamente.", item };
  } catch (error) {
    await logAudit({ traceId, action: "crearPatologiaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al crear patología";
    return { success: false, message: msg };
  }
}

export async function eliminarPatologiaAction(datos: unknown) {
  const parsed = eliminarItemSchema.safeParse(datos);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarPatologia(repoCatalogosApi, parsed.data.id);
    await logAudit({ traceId, action: "eliminarPatologiaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Patología eliminada exitosamente." };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarPatologiaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al eliminar patología";
    return { success: false, message: msg };
  }
}

export async function getCategoriasPatologiaAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCategoriasPatologia(repoCatalogosApi);
    await logAudit({ traceId, action: "getCategoriasPatologiaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCategoriasPatologiaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function crearCategoriaPatologiaAction(datos: unknown) {
  const parsed = crearCategoriaSchema.safeParse(datos);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const item = await crearCategoriaPatologia(repoCatalogosApi, parsed.data);
    await logAudit({ traceId, action: "crearCategoriaPatologiaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Categoría de patología creada exitosamente.", item };
  } catch (error) {
    await logAudit({ traceId, action: "crearCategoriaPatologiaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al crear categoría";
    return { success: false, message: msg };
  }
}

export async function eliminarCategoriaPatologiaAction(datos: unknown) {
  const parsed = eliminarItemSchema.safeParse(datos);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarCategoriaPatologia(repoCatalogosApi, parsed.data.id);
    await logAudit({ traceId, action: "eliminarCategoriaPatologiaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Categoría de patología eliminada." };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarCategoriaPatologiaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al eliminar categoría";
    return { success: false, message: msg };
  }
}

// Discapacidades
export async function crearDiscapacidadAction(datos: unknown) {
  const parsed = crearDiscapacidadSchema.safeParse(datos);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const item = await crearDiscapacidad(repoCatalogosApi, parsed.data);
    await logAudit({ traceId, action: "crearDiscapacidadAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Discapacidad creada exitosamente.", item };
  } catch (error) {
    await logAudit({ traceId, action: "crearDiscapacidadAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al crear discapacidad";
    return { success: false, message: msg };
  }
}

export async function eliminarDiscapacidadAction(datos: unknown) {
  const parsed = eliminarItemSchema.safeParse(datos);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarDiscapacidad(repoCatalogosApi, parsed.data.id);
    await logAudit({ traceId, action: "eliminarDiscapacidadAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Discapacidad eliminada exitosamente." };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarDiscapacidadAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al eliminar discapacidad";
    return { success: false, message: msg };
  }
}

export async function getCategoriasDiscapacidadAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCategoriasDiscapacidad(repoCatalogosApi);
    await logAudit({ traceId, action: "getCategoriasDiscapacidadAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCategoriasDiscapacidadAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function crearCategoriaDiscapacidadAction(datos: unknown) {
  const parsed = crearCategoriaSchema.safeParse(datos);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const item = await crearCategoriaDiscapacidad(repoCatalogosApi, parsed.data);
    await logAudit({ traceId, action: "crearCategoriaDiscapacidadAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Categoría de discapacidad creada exitosamente.", item };
  } catch (error) {
    await logAudit({ traceId, action: "crearCategoriaDiscapacidadAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al crear categoría";
    return { success: false, message: msg };
  }
}

export async function eliminarCategoriaDiscapacidadAction(datos: unknown) {
  const parsed = eliminarItemSchema.safeParse(datos);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarCategoriaDiscapacidad(repoCatalogosApi, parsed.data.id);
    await logAudit({ traceId, action: "eliminarCategoriaDiscapacidadAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Categoría de discapacidad eliminada." };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarCategoriaDiscapacidadAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al eliminar categoría";
    return { success: false, message: msg };
  }
}

// Tallas
export async function crearTallaAction(datos: unknown) {
  const parsed = crearTallaSchema.safeParse(datos);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const item = await crearTalla(repoCatalogosApi, parsed.data);
    await logAudit({ traceId, action: "crearTallaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Talla creada exitosamente.", item };
  } catch (error) {
    await logAudit({ traceId, action: "crearTallaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al crear talla";
    return { success: false, message: msg };
  }
}

export async function eliminarTallaAction(datos: unknown) {
  const parsed = eliminarItemSchema.safeParse(datos);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarTalla(repoCatalogosApi, parsed.data.id);
    await logAudit({ traceId, action: "eliminarTallaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Talla eliminada exitosamente." };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarTallaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al eliminar talla";
    return { success: false, message: msg };
  }
}

// Regiones de Talla
export async function crearRegionTallaAction(datos: unknown) {
  const parsed = crearRegionTallaSchema.safeParse(datos);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const item = await crearRegionTalla(repoCatalogosApi, parsed.data);
    await logAudit({ traceId, action: "crearRegionTallaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Región de talla creada exitosamente.", item };
  } catch (error) {
    await logAudit({ traceId, action: "crearRegionTallaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al crear región de talla";
    return { success: false, message: msg };
  }
}

export async function eliminarRegionTallaAction(datos: unknown) {
  const parsed = eliminarItemSchema.safeParse(datos);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarRegionTalla(repoCatalogosApi, parsed.data.id);
    await logAudit({ traceId, action: "eliminarRegionTallaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Región de talla eliminada exitosamente." };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarRegionTallaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al eliminar región de talla";
    return { success: false, message: msg };
  }
}

// Tipos de Prenda
export async function crearTipoPrendaAction(datos: unknown) {
  const parsed = crearTipoPrendaSchema.safeParse(datos);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const item = await crearTipoPrenda(repoCatalogosApi, parsed.data);
    await logAudit({ traceId, action: "crearTipoPrendaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Tipo de prenda creado exitosamente.", item };
  } catch (error) {
    await logAudit({ traceId, action: "crearTipoPrendaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al crear tipo de prenda";
    return { success: false, message: msg };
  }
}

export async function eliminarTipoPrendaAction(datos: unknown) {
  const parsed = eliminarItemSchema.safeParse(datos);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarTipoPrenda(repoCatalogosApi, parsed.data.id);
    await logAudit({ traceId, action: "eliminarTipoPrendaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true, message: "Tipo de prenda eliminado exitosamente." };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarTipoPrendaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const msg = error instanceof Error ? error.message : "Error al eliminar tipo de prenda";
    return { success: false, message: msg };
  }
}

