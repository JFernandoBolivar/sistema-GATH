/** Mapper API → DTO de parámetros del sistema. */
import type {
  CambioParametroDTO,
  PaginaCambiosDTO,
  ParametroDTO,
} from "../../application/dtos/parametro-dto";
import type {
  CambioParametroApiItem,
  PaginaCambiosApi,
  ParametroApiItem,
} from "../http/parametros-api";

export function parametroApiADTO(item: ParametroApiItem): ParametroDTO {
  return {
    clave: item.clave,
    etiqueta: item.etiqueta,
    descripcion: item.descripcion,
    grupo: item.grupo,
    tipo: item.tipo,
    valor: item.valor,
    defecto: item.defecto,
    minimo: item.minimo,
    maximo: item.maximo,
    actualizadoPorId: item.actualizado_por_id,
    actualizadoEn: item.actualizado_en,
  };
}

function cambioApiADTO(item: CambioParametroApiItem): CambioParametroDTO {
  return {
    fecha: item.fecha,
    actorCedula: item.actor_cedula,
    valorPrevio: item.valor_previo,
    valorNuevo: item.valor_nuevo,
    resultado: item.resultado,
  };
}

export function paginaCambiosApiADTO(pagina: PaginaCambiosApi): PaginaCambiosDTO {
  return {
    resultados: (pagina.resultados ?? []).map(cambioApiADTO),
    total: pagina.total ?? 0,
    pagina: pagina.pagina ?? 1,
    tamano: pagina.tamano ?? 10,
    totalPaginas: pagina.total_paginas ?? 1,
  };
}
