import type {
  FiltrosEstadisticas,
  FiltrosListadoEstadistica,
  RepoFeDeVida,
} from "../../domain/ports/repo-fe-de-vida";
import type { EstadisticasDTO, PasivoEstadisticaDTO } from "../dtos/fe-de-vida-dto";
import type { PaginaDTO } from "../dtos/fe-de-vida-dto";
import { normalizarPagina, vacioAUndefined } from "./paginacion";

function filtrosLimpios(f: Partial<FiltrosEstadisticas>) {
  return {
    procesoId: vacioAUndefined(f.procesoId),
    tipoNominaId: f.tipoNominaId && f.tipoNominaId > 0 ? f.tipoNominaId : undefined,
    estado: f.estado || undefined,
    canal: f.canal || undefined,
    desde: vacioAUndefined(f.desde),
    hasta: vacioAUndefined(f.hasta),
  };
}

/** KPIs, desgloses y matriz del proceso (por defecto el vigente). */
export function obtenerEstadisticas(
  repo: RepoFeDeVida,
  filtros: Partial<FiltrosEstadisticas> = {},
): Promise<EstadisticasDTO> {
  return repo.obtenerEstadisticas({
    ...normalizarPagina(filtros.limit, filtros.offset),
    ...filtrosLimpios(filtros),
  });
}

/** Detalle paginado: faltan por responder o una casilla de la matriz. */
export function listarPasivosEstadistica(
  repo: RepoFeDeVida,
  filtros: Partial<FiltrosListadoEstadistica> = {},
): Promise<PaginaDTO<PasivoEstadisticaDTO>> {
  return repo.listarPasivosEstadistica({
    ...normalizarPagina(filtros.limit, filtros.offset),
    ...filtrosLimpios(filtros),
    faltantes: filtros.faltantes || undefined,
  });
}

/** Parámetros de la exportación asíncrona (PDF/Excel). */
export function parametrosExportacion(
  filtros: Partial<FiltrosEstadisticas>,
  listado: "faltantes" | "celda",
): Record<string, string | number | boolean | undefined> {
  const limpios = filtrosLimpios(filtros);
  return {
    proceso_id: limpios.procesoId,
    tipo_nomina_id: limpios.tipoNominaId,
    estado: limpios.estado,
    canal: limpios.canal,
    desde: limpios.desde,
    hasta: limpios.hasta,
    listado,
  };
}
