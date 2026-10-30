/**
 * Cliente HTTP de la fe de vida: `/api/v1/fe-de-vida/`. Las respuestas JSON llegan en el sobre C-1
 * `{status, message, data}`; la constancia llega como PDF binario.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

const BASE = "/api/v1/fe-de-vida";

export interface DecisionApi {
  tipo: string;
  rol: string;
  actor_cedula: string;
  envio: number;
  motivo: string;
  fecha: string | null;
}

export interface SolicitudApi {
  id: string;
  proceso_id: string;
  cedula: string;
  nombre?: string;
  estado: string;
  version: number;
  envios: number;
  origen_evidencia: string | null;
  tiene_evidencia: boolean;
  via_aprobacion: string | null;
  requiere_nueva_foto?: boolean;
  fecha_envio: string | null;
  fecha_validacion: string | null;
  decisiones: DecisionApi[];
}

export interface CambioApi {
  id: string;
  seccion: string;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  campo: string;
  valor_anterior: unknown;
  valor_propuesto: unknown;
  valor_actual?: unknown;
  conflicto?: boolean;
}

export interface DetalleApi {
  solicitud: SolicitudApi;
  cambios: CambioApi[];
}

export interface ProcesoApi {
  id: string;
  nombre: string;
  estado: string;
  /** El contrato nuevo usa `apertura`/`cierre`; el serializer previo, `fecha_apertura`/`fecha_cierre`. */
  apertura?: string | null;
  cierre?: string | null;
  fecha_apertura?: string | null;
  fecha_cierre?: string | null;
  fecha_cierre_real?: string | null;
  tipos_nomina?: Array<{ id: number; nombre: string }>;
  dias_recordatorio?: number[];
}

export interface VigenteApi {
  proceso: ProcesoApi;
  solicitud: SolicitudApi | null;
  puede_enviar: boolean;
}

export interface ProrrogaApi {
  id: string;
  proceso_id: string;
  cedula: string;
  general: boolean;
  nueva_fecha_limite: string | null;
  motivo: string;
  concedida_por: string;
}

export interface CoberturaApi {
  cedula: string;
  nombre_completo: string;
  tipo_nomina: string;
  correo: string;
  sin_correo: boolean;
  tiene_cuenta: boolean;
}

export interface PaginaApi<T> {
  count: number;
  limit: number;
  offset: number;
  results: T[];
}

export interface TipoPensionApi {
  id: number;
  nombre: string;
}

export interface UrlEvidenciaApi {
  url: string;
  expira_en_segundos: number;
}

export interface CuerpoProceso {
  nombre: string;
  fecha_apertura: string;
  fecha_cierre: string;
  tipos_nomina: number[];
  dias_recordatorio: number[];
}

type Params = Record<string, string | number | boolean | undefined | null>;

export const feDeVidaApi = {
  vigente: () => apiClient.get<ApiResponse<VigenteApi | null>>(`${BASE}/procesos/vigente/`),
  iniciar: () => apiClient.post<ApiResponse<SolicitudApi>>(`${BASE}/procesos/vigente/solicitud/`),
  misSolicitudes: (params: Params) =>
    apiClient.get<ApiResponse<PaginaApi<SolicitudApi>>>(`${BASE}/mis-solicitudes/`, { params }),
  miSolicitud: (id: string) =>
    apiClient.get<ApiResponse<DetalleApi>>(`${BASE}/mis-solicitudes/${id}/`),
  borrador: (id: string, cambios: unknown[]) =>
    apiClient.put<ApiResponse<DetalleApi>>(`${BASE}/mis-solicitudes/${id}/borrador/`, { cambios }),
  evidencia: (id: string, form: FormData) =>
    apiClient.postForm<ApiResponse<SolicitudApi>>(`${BASE}/mis-solicitudes/${id}/evidencia/`, form),
  enviar: (id: string) =>
    apiClient.post<ApiResponse<SolicitudApi>>(`${BASE}/mis-solicitudes/${id}/enviar/`),
  constancia: (id: string) => apiClient.getBlob(`${BASE}/mis-solicitudes/${id}/constancia/`),

  bandeja: (params: Params) =>
    apiClient.get<ApiResponse<PaginaApi<SolicitudApi>>>(`${BASE}/solicitudes/`, { params }),
  detalleRevision: (id: string) => apiClient.get<ApiResponse<DetalleApi>>(`${BASE}/solicitudes/${id}/`),
  urlEvidencia: (id: string) =>
    apiClient.get<ApiResponse<UrlEvidenciaApi>>(`${BASE}/solicitudes/${id}/evidencia/`),
  check: (id: string) => apiClient.post<ApiResponse<SolicitudApi>>(`${BASE}/solicitudes/${id}/check/`),
  aprobarDirecto: (id: string, justificacion: string) =>
    apiClient.post<ApiResponse<SolicitudApi>>(`${BASE}/solicitudes/${id}/aprobar-directo/`, {
      justificacion,
    }),
  devolver: (id: string, motivo: string, requiereNuevaFoto: boolean) =>
    apiClient.post<ApiResponse<SolicitudApi>>(`${BASE}/solicitudes/${id}/devolver/`, {
      motivo,
      requiere_nueva_foto: requiereNuevaFoto,
    }),
  rechazar: (id: string, motivo: string) =>
    apiClient.post<ApiResponse<SolicitudApi>>(`${BASE}/solicitudes/${id}/rechazar/`, { motivo }),

  procesos: (params: Params) =>
    apiClient.get<ApiResponse<PaginaApi<ProcesoApi>>>(`${BASE}/procesos/`, { params }),
  tiposPension: () => apiClient.get<ApiResponse<TipoPensionApi[]>>(`${BASE}/procesos/tipos-pension/`),
  crearProceso: (cuerpo: CuerpoProceso) =>
    apiClient.post<ApiResponse<ProcesoApi>>(`${BASE}/procesos/`, { ...cuerpo }),
  editarProceso: (id: string, cuerpo: CuerpoProceso) =>
    apiClient.patch<ApiResponse<ProcesoApi>>(`${BASE}/procesos/${id}/`, { ...cuerpo }),
  abrir: (id: string) => apiClient.post<ApiResponse<ProcesoApi>>(`${BASE}/procesos/${id}/abrir/`),
  cerrar: (id: string) => apiClient.post<ApiResponse<ProcesoApi>>(`${BASE}/procesos/${id}/cerrar/`),
  prorrogas: (id: string) =>
    apiClient.get<ApiResponse<ProrrogaApi[] | PaginaApi<ProrrogaApi>>>(
      `${BASE}/procesos/${id}/prorrogas/`,
    ),
  prorrogar: (id: string, cuerpo: Record<string, unknown>) =>
    apiClient.post<ApiResponse<ProrrogaApi>>(`${BASE}/procesos/${id}/prorrogas/`, cuerpo),

  cobertura: (params: Params) =>
    apiClient.get<ApiResponse<PaginaApi<CoberturaApi>>>(`${BASE}/cobertura/pasivos/`, { params }),
};
