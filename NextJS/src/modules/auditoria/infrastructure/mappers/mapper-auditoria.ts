/** Mappers API → DTO de auditoría. */
import type {
  DetalleAuditoriaDTO,
  IncidenteSeguridadDTO,
  OpcionesAuditoriaDTO,
  PaginaAuditoriaDTO,
  PaginaIncidentesDTO,
  RegistroAuditoriaDTO,
} from "../../application/dtos/auditoria-dto";
import type {
  DetalleAuditoriaApiItem,
  IncidenteSeguridadApiItem,
  OpcionesAuditoriaApi,
  PaginaAuditoriaApi,
  PaginaIncidentesApi,
  RegistroAuditoriaApiItem,
} from "../http/auditoria-api";

export function registroApiADTO(item: RegistroAuditoriaApiItem): RegistroAuditoriaDTO {
  return {
    id: item.id,
    fechaHora: item.fecha_hora,
    actorCedula: item.actor_cedula,
    actorNombre: item.actor_nombre,
    actorRol: item.actor_rol,
    modulo: item.modulo,
    accion: item.accion,
    recursoTipo: item.recurso_tipo,
    recursoId: item.recurso_id,
    ip: item.ip,
    userAgent: item.user_agent,
    resultado: item.resultado,
  };
}

export function detalleApiADTO(item: DetalleAuditoriaApiItem): DetalleAuditoriaDTO {
  return {
    ...registroApiADTO(item),
    estadoPrevio: item.estado_previo ?? null,
    estadoNuevo: item.estado_nuevo ?? null,
    diferencias: (item.diferencias ?? []).map((d) => ({
      campo: d.campo,
      antes: d.antes,
      despues: d.despues,
    })),
  };
}

export function incidenteApiADTO(item: IncidenteSeguridadApiItem): IncidenteSeguridadDTO {
  return {
    id: item.id,
    fechaHora: item.fecha_hora,
    cedula: item.cedula,
    nombre: item.nombre,
    ip: item.ip,
    resultado: item.resultado,
  };
}

export function paginaApiADTO(pagina: PaginaAuditoriaApi): PaginaAuditoriaDTO {
  return {
    resultados: (pagina.resultados ?? []).map(registroApiADTO),
    total: pagina.total ?? 0,
    pagina: pagina.pagina ?? 1,
    tamano: pagina.tamano ?? 10,
    totalPaginas: pagina.total_paginas ?? 1,
  };
}

export function paginaIncidentesApiADTO(pagina: PaginaIncidentesApi): PaginaIncidentesDTO {
  return {
    resultados: (pagina.resultados ?? []).map(incidenteApiADTO),
    total: pagina.total ?? 0,
    pagina: pagina.pagina ?? 1,
    tamano: pagina.tamano ?? 10,
    totalPaginas: pagina.total_paginas ?? 1,
  };
}

export function opcionesApiADTO(opciones: OpcionesAuditoriaApi): OpcionesAuditoriaDTO {
  return {
    acciones: opciones.acciones ?? [],
    modulos: opciones.modulos ?? [],
    resultados: opciones.resultados ?? [],
  };
}
