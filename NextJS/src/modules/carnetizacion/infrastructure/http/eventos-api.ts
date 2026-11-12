/**
 * Cliente HTTP de Eventos, Invitados y Control de Entrada (O45-B).
 *
 * Vive en `infrastructure/http` (no en `application`): la capa de aplicación no
 * puede depender del transporte. Las Server Actions de `eventos-actions.ts` son
 * quienes lo consumen.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";
import type {
  CheckInResponse,
  Evento,
  EventoCategoria,
  EventoInvitado,
  EventoZona,
  FiltrosInvitados,
  FiltroPersonalInvitable,
  PaginaPersonasInvitables,
  ResultadoAgregarEnBloque,
  SolicitudAgregarEnBloque,
  PaginaEventos,
  PaginaInvitados,
  PanelEvento,
  ResumenImportacion,
} from "@/modules/carnetizacion/domain/entities/evento";

const BASE_URL = "/api/v1/carnetizacion/eventos";

export async function getEventos(filtros?: {
  estado?: string;
  busqueda?: string;
}): Promise<Evento[]> {
  const params: Record<string, string | undefined> = {};
  if (filtros?.estado) params.estado = filtros.estado;
  if (filtros?.busqueda) params.busqueda = filtros.busqueda;

  const res = await apiClient.get<ApiResponse<Evento[]>>(`${BASE_URL}/`, {
    params,
  });
  return res.data || [];
}

export async function getEventosPaginado(filtros: {
  estado?: string;
  busqueda?: string;
  pagina: number;
  page_size: number;
}): Promise<PaginaEventos> {
  const params: Record<string, string | number | undefined> = {
    pagina: filtros.pagina,
    page_size: filtros.page_size,
  };
  if (filtros.estado) params.estado = filtros.estado;
  if (filtros.busqueda) params.busqueda = filtros.busqueda;
  const res = await apiClient.get<ApiResponse<PaginaEventos>>(`${BASE_URL}/`, { params });
  return res.data;
}

export async function getEventoDetalle(id: string): Promise<Evento | null> {
  const res = await apiClient.get<ApiResponse<Evento>>(`${BASE_URL}/${id}/`);
  return res.data || null;
}

export async function crearEvento(datos: {
  nombre: string;
  lugar: string;
  fecha_inicio: string;
  fecha_fin: string;
  descripcion?: string;
  plantilla_id?: string | null;
  categorias?: Array<{
    nombre: string;
    color_primario?: string;
    color_acento?: string;
    orden?: number;
  }>;
  zonas?: Array<{
    nombre: string;
    codigo?: string;
    orden?: number;
  }>;
}): Promise<Evento> {
  const res = await apiClient.post<ApiResponse<Evento>>(`${BASE_URL}/`, datos);
  if (!res.data) {
    throw new Error(res.message || "Error al crear evento");
  }
  return res.data;
}

export async function actualizarEvento(
  id: string,
  datos: Partial<Evento>
): Promise<Evento> {
  const res = await apiClient.put<ApiResponse<Evento>>(
    `${BASE_URL}/${id}/`,
    datos as Record<string, unknown>
  );
  if (!res.data) {
    throw new Error(res.message || "Error al actualizar evento");
  }
  return res.data;
}

export async function getCategoriasEvento(
  eventoId: string
): Promise<EventoCategoria[]> {
  const res = await apiClient.get<ApiResponse<EventoCategoria[]>>(
    `${BASE_URL}/${eventoId}/categorias/`
  );
  return res.data || [];
}

export async function crearCategoriaEvento(
  eventoId: string,
  datos: {
    nombre: string;
    color_primario?: string;
    color_acento?: string;
    orden?: number;
  }
): Promise<EventoCategoria> {
  const res = await apiClient.post<ApiResponse<EventoCategoria>>(
    `${BASE_URL}/${eventoId}/categorias/`,
    datos
  );
  if (!res.data) {
    throw new Error(res.message || "Error al crear categoría");
  }
  return res.data;
}

export async function getZonasEvento(eventoId: string): Promise<EventoZona[]> {
  const res = await apiClient.get<ApiResponse<EventoZona[]>>(
    `${BASE_URL}/${eventoId}/zonas/`
  );
  return res.data || [];
}

export async function crearZonaEvento(
  eventoId: string,
  datos: {
    nombre: string;
    codigo?: string;
    orden?: number;
  }
): Promise<EventoZona> {
  const res = await apiClient.post<ApiResponse<EventoZona>>(
    `${BASE_URL}/${eventoId}/zonas/`,
    datos
  );
  if (!res.data) {
    throw new Error(res.message || "Error al crear zona");
  }
  return res.data;
}

function paramsInvitados(filtros?: FiltrosInvitados): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {};
  if (filtros?.categoria_id) params.categoria_id = filtros.categoria_id;
  if (filtros?.zona_id) params.zona_id = filtros.zona_id;
  if (filtros?.estado) params.estado = filtros.estado;
  if (filtros?.busqueda) params.busqueda = filtros.busqueda;
  if (filtros?.pagina) params.pagina = String(filtros.pagina);
  if (filtros?.page_size) params.page_size = String(filtros.page_size);
  return params;
}

/** Una página de invitados; filtros y corte de página los resuelve el servidor. */
export async function getInvitadosEvento(
  eventoId: string,
  filtros?: FiltrosInvitados
): Promise<PaginaInvitados> {
  const res = await apiClient.get<ApiResponse<PaginaInvitados>>(
    `${BASE_URL}/${eventoId}/invitados/`,
    { params: paramsInvitados(filtros) }
  );
  return (
    res.data || { resultados: [], total: 0, pagina: 1, tamano: filtros?.page_size ?? 10, total_paginas: 1 }
  );
}

/** Ids de todos los invitados que cumplen el filtro (selección masiva), sin paginar. */
export async function getIdsInvitadosEvento(
  eventoId: string,
  filtros?: Omit<FiltrosInvitados, "pagina" | "page_size">
): Promise<string[]> {
  const res = await apiClient.get<ApiResponse<{ ids: string[]; total: number }>>(
    `${BASE_URL}/${eventoId}/invitados/ids/`,
    { params: paramsInvitados(filtros) }
  );
  return res.data?.ids || [];
}

export async function crearInvitado(
  eventoId: string,
  datos: {
    nombre_completo: string;
    categoria_id: string;
    zona_id: string;
    documento_identidad?: string;
    organizacion?: string;
    correo?: string;
    telefono?: string;
    mesa?: string;
    es_acompanante?: boolean;
    trabajador_titular_id?: number | null;
    observaciones?: string;
  }
): Promise<EventoInvitado> {
  const res = await apiClient.post<ApiResponse<EventoInvitado>>(
    `${BASE_URL}/${eventoId}/invitados/`,
    datos as Record<string, unknown>
  );
  if (!res.data) {
    throw new Error(res.message || "Error al registrar invitado");
  }
  return res.data;
}

export async function actualizarInvitado(
  invitadoId: string,
  datos: Partial<EventoInvitado>
): Promise<EventoInvitado> {
  const res = await apiClient.put<ApiResponse<EventoInvitado>>(
    `${BASE_URL}/invitados/${invitadoId}/`,
    datos as Record<string, unknown>
  );
  if (!res.data) {
    throw new Error(res.message || "Error al actualizar invitado");
  }
  return res.data;
}

export async function eliminarInvitado(invitadoId: string): Promise<boolean> {
  const res = await apiClient.delete<ApiResponse<{ eliminado: boolean }>>(
    `${BASE_URL}/invitados/${invitadoId}/`
  );
  return Boolean(res.data?.eliminado);
}

export async function importarInvitados(
  eventoId: string,
  payload: {
    filas?: unknown[];
    archivo?: File;
    confirmar?: boolean;
  }
): Promise<ResumenImportacion> {
  if (payload.archivo) {
    const formData = new FormData();
    formData.append("archivo", payload.archivo);
    formData.append("confirmar", payload.confirmar ? "true" : "false");

    const res = await apiClient.postForm<ApiResponse<ResumenImportacion>>(
      `${BASE_URL}/${eventoId}/invitados/importar/`,
      formData
    );
    if (!res.data) {
      throw new Error(res.message || "Error al procesar archivo de importación");
    }
    return res.data;
  }

  const res = await apiClient.post<ApiResponse<ResumenImportacion>>(
    `${BASE_URL}/${eventoId}/invitados/importar/`,
    {
      filas: payload.filas || [],
      confirmar: Boolean(payload.confirmar),
    }
  );
  if (!res.data) {
    throw new Error(res.message || "Error al procesar datos de importación");
  }
  return res.data;
}

export async function emitirCredencialesLote(
  eventoId: string,
  invitadosIds?: string[]
): Promise<{ total_procesados: number; total_emitidos: number }> {
  const res = await apiClient.post<
    ApiResponse<{ total_procesados: number; total_emitidos: number }>
  >(`${BASE_URL}/${eventoId}/emitir-lote/`, {
    invitados_ids: invitadosIds || [],
  });
  return res.data || { total_procesados: 0, total_emitidos: 0 };
}

export async function enviarCredencialesCorreo(
  eventoId: string,
  invitadosIds?: string[]
): Promise<{ total_enviados: number; total_fallidos: number }> {
  const res = await apiClient.post<
    ApiResponse<{ total_enviados: number; total_fallidos: number }>
  >(`${BASE_URL}/${eventoId}/enviar-correo/`, {
    invitados_ids: invitadosIds || [],
  });
  return res.data || { total_enviados: 0, total_fallidos: 0 };
}

export async function getPanelEvento(eventoId: string): Promise<PanelEvento> {
  const res = await apiClient.get<ApiResponse<PanelEvento>>(
    `${BASE_URL}/${eventoId}/panel/`
  );
  if (!res.data) {
    throw new Error(res.message || "Error al cargar panel de evento");
  }
  return res.data;
}

export async function checkInAcceso(datos: {
  codigo_o_hash: string;
  evento_id?: string;
  zona_id?: string;
}): Promise<CheckInResponse> {
  const res = await apiClient.post<ApiResponse<CheckInResponse>>(
    `/api/v1/carnetizacion/control-eventos/check-in/`,
    datos
  );
  if (!res.data) {
    throw new Error(res.message || "Error al procesar control de entrada");
  }
  return res.data;
}

function paramsPersonal(f: Partial<FiltroPersonalInvitable>): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {};
  if (f.poblacion) params.poblacion = f.poblacion;
  if (f.dependencia_id) params.dependencia_id = String(f.dependencia_id);
  if (f.busqueda) params.busqueda = f.busqueda;
  if (f.pagina) params.pagina = String(f.pagina);
  if (f.page_size) params.page_size = String(f.page_size);
  return params;
}

/** Trabajadores que pueden invitarse (filtro, búsqueda y página en el servidor). */
export async function getPersonalInvitable(
  eventoId: string,
  filtro: FiltroPersonalInvitable
): Promise<PaginaPersonasInvitables> {
  const res = await apiClient.get<ApiResponse<PaginaPersonasInvitables>>(
    `${BASE_URL}/${eventoId}/invitables/personal/`,
    { params: paramsPersonal(filtro) }
  );
  if (!res.data) throw new Error(res.message || "Error al buscar personal");
  return res.data;
}

/** Cédulas de todo el filtro que aún no están invitadas. */
export async function getIdsPersonalInvitable(
  eventoId: string,
  filtro: Omit<FiltroPersonalInvitable, "pagina" | "page_size">
): Promise<string[]> {
  const res = await apiClient.get<ApiResponse<{ ids: string[] }>>(
    `${BASE_URL}/${eventoId}/invitables/personal/ids/`,
    { params: paramsPersonal(filtro) }
  );
  return res.data?.ids ?? [];
}

export async function getExternosInvitables(
  eventoId: string,
  filtro: { busqueda?: string; pagina?: number; page_size?: number }
): Promise<PaginaPersonasInvitables> {
  const res = await apiClient.get<ApiResponse<PaginaPersonasInvitables>>(
    `${BASE_URL}/${eventoId}/invitables/externos/`,
    { params: paramsPersonal(filtro as Partial<FiltroPersonalInvitable>) }
  );
  if (!res.data) throw new Error(res.message || "Error al buscar externos");
  return res.data;
}

export async function getIdsExternosInvitables(
  eventoId: string,
  busqueda?: string
): Promise<string[]> {
  const res = await apiClient.get<ApiResponse<{ ids: string[] }>>(
    `${BASE_URL}/${eventoId}/invitables/externos/ids/`,
    { params: paramsPersonal({ busqueda }) }
  );
  return res.data?.ids ?? [];
}

export async function agregarInvitadosEnBloque(
  eventoId: string,
  solicitud: SolicitudAgregarEnBloque
): Promise<ResultadoAgregarEnBloque> {
  const res = await apiClient.post<ApiResponse<ResultadoAgregarEnBloque>>(
    `${BASE_URL}/${eventoId}/invitados/agregar-en-bloque/`,
    { ...solicitud }
  );
  if (!res.data) throw new Error(res.message || "Error al agregar invitados");
  return res.data;
}

export async function actualizarCategoriaEvento(
  categoriaId: string,
  datos: { nombre?: string; color_primario?: string; color_acento?: string; orden?: number }
): Promise<EventoCategoria> {
  const res = await apiClient.patch<ApiResponse<EventoCategoria>>(
    `${BASE_URL}/categorias/${categoriaId}/`,
    datos
  );
  if (!res.data) throw new Error(res.message || "Error al actualizar categoría");
  return res.data;
}

export async function eliminarCategoriaEvento(categoriaId: string): Promise<void> {
  await apiClient.delete<ApiResponse<{ eliminado: boolean }>>(
    `${BASE_URL}/categorias/${categoriaId}/`
  );
}

export async function actualizarZonaEvento(
  zonaId: string,
  datos: { nombre?: string; codigo?: string; orden?: number }
): Promise<EventoZona> {
  const res = await apiClient.patch<ApiResponse<EventoZona>>(
    `${BASE_URL}/zonas/${zonaId}/`,
    datos
  );
  if (!res.data) throw new Error(res.message || "Error al actualizar zona");
  return res.data;
}

export async function eliminarZonaEvento(zonaId: string): Promise<void> {
  await apiClient.delete<ApiResponse<{ eliminado: boolean }>>(`${BASE_URL}/zonas/${zonaId}/`);
}
