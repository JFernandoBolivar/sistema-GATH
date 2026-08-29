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
import { repoCatalogosApi } from "../repositories/repo-catalogos-api";
import { idPadreFiltroSchema } from "../../ui/schema/schema-catalogos";

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
