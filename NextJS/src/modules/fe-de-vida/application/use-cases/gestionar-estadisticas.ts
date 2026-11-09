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

export interface OpcionesReporteEstadisticas {
  formato: "pdf" | "excel";
  incluirResumen: boolean;
  incluirGraficos: boolean;
  incluirListado: boolean;
  alcanceListado: "faltan" | "respondieron" | "ambos";
  listado?: "faltantes" | "celda";
}

/** Parámetros de la exportación asíncrona (PDF/Excel) de estadísticas (O21, O25). */
export function parametrosExportacion(
  filtros: Partial<FiltrosEstadisticas>,
  opciones?: "faltantes" | "celda" | Partial<OpcionesReporteEstadisticas>,
): Record<string, string | number | boolean | undefined> {
  const limpios = filtrosLimpios(filtros);
  const base: Record<string, string | number | boolean | undefined> = {
    proceso_id: limpios.procesoId,
    tipo_nomina_id: limpios.tipoNominaId,
    estado: limpios.estado,
    canal: limpios.canal,
    desde: limpios.desde,
    hasta: limpios.hasta,
  };

  if (typeof opciones === "string") {
    base.listado = opciones;
  } else if (opciones) {
    if (opciones.formato) base.formato = opciones.formato;
    if (opciones.incluirResumen !== undefined) base.incluir_resumen = opciones.incluirResumen;
    if (opciones.incluirGraficos !== undefined) base.incluir_graficos = opciones.incluirGraficos;
    if (opciones.incluirListado !== undefined) base.incluir_listado = opciones.incluirListado;
    if (opciones.alcanceListado) base.alcance_listado = opciones.alcanceListado;
    if (opciones.listado) base.listado = opciones.listado;
  }
  return base;
}
