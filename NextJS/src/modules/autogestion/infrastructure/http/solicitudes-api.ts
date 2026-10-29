/**
 * Cliente HTTP de la autogestión por solicitud: `/api/v1/autogestion/` (trabajador y Bienestar).
 * Todas las respuestas llegan en el sobre C-1 `{status, message, data}`.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";
import type { ItemBorrador } from "../../domain/entities/solicitud-actualizacion";

const BASE = "/api/v1/autogestion";

export interface SolicitudApi {
  id: string;
  cedula: string;
  estado: string;
  secciones_solicitadas: string[];
  secciones_habilitadas: string[];
  motivo: string;
  ventana_inicio: string | null;
  ventana_fin: string | null;
  plazo_dias: number | null;
  habilitada_por: string;
  decidida_por: string;
  motivo_decision: string;
  version: number;
  fecha_solicitud: string | null;
  fecha_envio: string | null;
  fecha_decision: string | null;
}

export interface CambioApi {
  id: string;
  seccion: string;
  accion: string;
  entidad_destino: string;
  entidad_id: string | null;
  campo: string;
  valor_anterior: unknown;
  valor_propuesto: unknown;
  valor_actual: unknown;
  conflicto: boolean;
  decision: string;
  motivo_decision: string;
  decidido_por: string;
  fecha_decision: string | null;
}

export interface SoporteApi {
  id: string;
  seccion: string;
  tipo: string;
  mime_real: string;
  tamano_bytes: number;
  nombre_original: string;
  fecha: string | null;
  url_archivo: string;
}

export interface ProrrogaApi {
  id: string;
  fecha_fin_anterior: string;
  fecha_fin_nueva: string;
  motivo: string;
  prorrogada_por: string;
  fecha: string | null;
}

export interface DetalleSolicitudApi extends SolicitudApi {
  cambios: CambioApi[];
  soportes: SoporteApi[];
  prorrogas: ProrrogaApi[];
}

export interface PaginaSolicitudesApi {
  count: number;
  limit: number;
  offset: number;
  results: SolicitudApi[];
}

export interface SeccionApi {
  codigo: string;
  nombre: string;
  requiere_soporte: boolean;
  activa: boolean;
}

export interface DatosComplementariosApi {
  cedula: string;
  correo_alternativo: string | null;
  tiene_hijos: boolean | null;
  actualizado_en: string | null;
  actualizado_por: string;
}

export interface DecidirApi {
  version: number;
  decisiones: { cambio_id: string; aprobado: boolean; motivo: string }[];
  motivo_general?: string;
}

function cuerpoBorrador(cambios: ItemBorrador[], version?: number): Record<string, unknown> {
  return {
    ...(version !== undefined ? { version } : {}),
    cambios: cambios.map((c) => ({
      seccion: c.seccion,
      entidad: c.entidad,
      accion: c.accion,
      campo: c.campo,
      valor: c.valor,
      ...(c.entidadId ? { entidad_id: c.entidadId } : {}),
    })),
  };
}

export const solicitudesApi = {
  // Trabajador
  listarMias: () => apiClient.get<ApiResponse<SolicitudApi[]>>(`${BASE}/solicitudes/`),
  obtenerMia: (id: string) =>
    apiClient.get<ApiResponse<DetalleSolicitudApi>>(`${BASE}/solicitudes/${id}/`),
  solicitar: (secciones: string[], motivo: string) =>
    apiClient.post<ApiResponse<SolicitudApi>>(`${BASE}/solicitudes/`, { secciones, motivo }),
  guardarBorrador: (id: string, cambios: ItemBorrador[], version?: number) =>
    apiClient.put<ApiResponse<DetalleSolicitudApi>>(
      `${BASE}/solicitudes/${id}/borrador/`,
      cuerpoBorrador(cambios, version),
    ),
  subirSoporte: (id: string, formData: FormData) =>
    apiClient.postForm<ApiResponse<SoporteApi>>(`${BASE}/solicitudes/${id}/soportes/`, formData),
  eliminarSoporte: (id: string, soporteId: string) =>
    apiClient.delete<ApiResponse<{ eliminado: boolean }>>(
      `${BASE}/solicitudes/${id}/soportes/${soporteId}/`,
    ),
  enviar: (id: string, version?: number) =>
    apiClient.post<ApiResponse<SolicitudApi>>(
      `${BASE}/solicitudes/${id}/enviar/`,
      version !== undefined ? { version } : {},
    ),
  listarSecciones: () => apiClient.get<ApiResponse<SeccionApi[]>>(`${BASE}/secciones/`),
  misDatosComplementarios: () =>
    apiClient.get<ApiResponse<DatosComplementariosApi>>(`${BASE}/mis-datos-complementarios/`),

  // Bienestar
  listarBandeja: (params: { estado?: string; cedula?: string; limit: number; offset: number }) =>
    apiClient.get<ApiResponse<PaginaSolicitudesApi>>(`${BASE}/bienestar/solicitudes/`, { params }),
  obtenerDetalle: (id: string) =>
    apiClient.get<ApiResponse<DetalleSolicitudApi>>(`${BASE}/bienestar/solicitudes/${id}/`),
  obtenerComparativo: (id: string) =>
    apiClient.get<ApiResponse<DetalleSolicitudApi>>(
      `${BASE}/bienestar/solicitudes/${id}/comparativo/`,
    ),
  habilitar: (id: string, plazoDias: number, secciones?: string[]) =>
    apiClient.post<ApiResponse<SolicitudApi>>(`${BASE}/bienestar/solicitudes/${id}/habilitar/`, {
      plazo_dias: plazoDias,
      ...(secciones ? { secciones } : {}),
    }),
  prorrogar: (id: string, nuevaFechaFin: string, motivo: string) =>
    apiClient.post<ApiResponse<SolicitudApi>>(`${BASE}/bienestar/solicitudes/${id}/prorrogar/`, {
      nueva_fecha_fin: nuevaFechaFin,
      motivo,
    }),
  decidir: (id: string, cuerpo: DecidirApi) =>
    apiClient.post<ApiResponse<DetalleSolicitudApi>>(
      `${BASE}/bienestar/solicitudes/${id}/decidir/`,
      cuerpo as unknown as Record<string, unknown>,
    ),
  rechazar: (id: string, motivo: string, version?: number) =>
    apiClient.post<ApiResponse<SolicitudApi>>(`${BASE}/bienestar/solicitudes/${id}/rechazar/`, {
      motivo,
      ...(version !== undefined ? { version } : {}),
    }),
};
