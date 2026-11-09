/**
 * Implementación del repositorio de Movimientos usando la API REST.
 */
import type {
  CatalogoTiposMovimientoInfo,
  FiltrosMovimiento,
  RepoMovimientos,
} from "../../domain/ports/repo-movimientos";
import type { PaginaHistorial } from "../../domain/value-objects/resultado-historial";
import {
  movimientosApi,
  type MovimientoApiItem,
  type PaginaMovimientosApi,
} from "../http/movimientos-api";
import { movimientoApiAEntidad } from "../mappers/mapper-movimientos";

function extraerLista<T = MovimientoApiItem>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: T[] }).data;
  }
  return [];
}

function aFiltrosApi(filtros?: FiltrosMovimiento) {
  return {
    cedula: filtros?.cedula,
    codigo_puesto: filtros?.codigoPuesto,
    categoria: filtros?.categoria,
    tipo_movimiento: filtros?.tipoMovimiento,
    fecha_inicio: filtros?.fechaInicio,
    fecha_fin: filtros?.fechaFin,
    gerencia: filtros?.gerencia,
    estatus: filtros?.estatus,
  };
}

function aPagina(raw: unknown): PaginaHistorial {
  const envoltorio = raw as { data?: PaginaMovimientosApi } | PaginaMovimientosApi | null;
  const data = (envoltorio && "data" in (envoltorio as object)
    ? (envoltorio as { data: PaginaMovimientosApi }).data
    : (envoltorio as PaginaMovimientosApi)) ?? {
    resultados: [],
    total: 0,
    pagina: 1,
    tamano: 10,
    total_paginas: 1,
  };
  return {
    items: (data.resultados ?? []).map(movimientoApiAEntidad),
    total: data.total ?? 0,
    pagina: data.pagina ?? 1,
    tamano: data.tamano ?? 10,
    totalPaginas: data.total_paginas ?? 1,
  };
}

export const repoMovimientosApi: RepoMovimientos = {
  async listarHistorial(filtros?: FiltrosMovimiento, pagina = 1, tamano = 10) {
    const raw = await movimientosApi.getHistorial(aFiltrosApi(filtros), pagina, tamano);
    return aPagina(raw);
  },

  async listarHistorialPorEmpleado(cedula) {
    const raw = await movimientosApi.getHistorialPorEmpleado(cedula);
    return extraerLista<MovimientoApiItem>(raw).map(movimientoApiAEntidad);
  },

  async listarHistorialPorCargo(codigoPuesto) {
    const raw = await movimientosApi.getHistorialPorCargo(codigoPuesto);
    return extraerLista<MovimientoApiItem>(raw).map(movimientoApiAEntidad);
  },

  async listarTiposDisponibles() {
    const raw = await movimientosApi.getTiposDisponibles();
    if (raw && typeof raw === "object" && "data" in raw) {
      return (raw as { data: CatalogoTiposMovimientoInfo }).data;
    }
    return raw as CatalogoTiposMovimientoInfo;
  },
};
