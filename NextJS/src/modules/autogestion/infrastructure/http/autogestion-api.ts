/**
 * Cliente HTTP para Autogestión conectado a la API canónica /api/v1/autogestion/
 * y /api/v1/catalogos/, /api/v1/organizacion/, /api/v1/personal/.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type {
  ApiResponse,
  Pregunta,
  States,
  Municipality,
  Parish,
  ConditionDwelling,
  CodigoPostal,
  ReporteCensoData,
} from "@/app/types/types";
import type { MiExpedienteDTO } from "../../application/dtos/mi-expediente-dto";


/**
 * Los catálogos de /api/v1/organizacion/ y /api/v1/catalogos/tipos-nomina/ usan
 * el envelope CatalogoItemSerializer/DTO propio del backend nuevo (id, codigo,
 * nombre) -- distinto del shape legado (Codigo, dependencia/nomina, etc.) que
 * describen Dependency/DirectionGeneral/DirectionLine/Coordination/NominaGeneral
 * en @/app/types/types, usado por el API legado (getInfoRac.ts). Reusar esos
 * tipos legados aquí causaba que labelKey leyera un campo inexistente y
 * mostrara literalmente "undefined" en los selects de filtros.
 */
export interface DependenciaApiItem {
  id: number;
  codigo: string | null;
  nombre: string;
}

export interface DireccionGeneralApiItem {
  id: number;
  codigo: string | null;
  nombre: string;
  dependencia_id: number;
}

export interface DireccionLineaApiItem {
  id: number;
  codigo: string | null;
  nombre: string;
  direccion_general_id: number;
}

export interface CoordinacionApiItem {
  id: number;
  codigo: string | null;
  nombre: string;
  direccion_linea_id: number;
}

export interface TipoNominaApiItem {
  id: number;
  nombre: string;
  codigo?: string | null;
}

export interface OpcionPreguntaApiItem {
  id: number;
  texto: string;
  orden: number;
}

export interface PreguntaCensoApiItem {
  id: number;
  enunciado: string;
  tipo: string;
  orden: number;
  activo: boolean;
  validacion: string | null;
  opciones: OpcionPreguntaApiItem[];
}

export interface RespuestaCensoApiItem {
  id: number;
  pregunta_id: number;
  pregunta_enunciado: string;
  empleado_cedula: string;
  opcion_id: number | null;
  opcion_texto: string | null;
  respuesta_texto: string;
}

export interface ReporteDependenciaApiItem {
  dependencia_id: number;
  dependencia: string;
  total_empleados: number;
  empleados_censados: number;
}

export interface MetricasCensoApiItem {
  total_empleados_censados: number;
  total_respuestas: number;
  por_dependencia: ReporteDependenciaApiItem[];
}

export interface CensoEmpleadoItem {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string | null;
  carnet_patria: string | null;
  cargos: any[];
  datos_vivienda: any | null;
  total_apn: { years: number; months: number; days: number };
  fecha_ingreso_organismo: string | null;
  preguntas: {
    id: number;
    pregunta: string;
    tipo: string;
    opcion: { id: number; opcion: string } | null;
    respuesta: string;
  }[];
}

export interface SubmitPayload {
  carnet_patria: string;
  datos_vivienda?: {
    direccion_exacta?: string;
    estado_id?: number;
    municipio_id?: number;
    parroquia?: number;
    condicion_vivienda_id?: number;
    codigo_postal_id?: number;
  };
  respuestas: {
    pregunta: number;
    opcion: number | null;
    respuesta: string;
  }[];
}

export const autogestionApi = {
  getMiExpediente: async (): Promise<ApiResponse<MiExpedienteDTO>> => {
    return apiClient.get<ApiResponse<MiExpedienteDTO>>("/api/v1/autogestion/mi-expediente/");
  },

  getPreguntas: async (): Promise<ApiResponse<Pregunta[]>> => {
    return apiClient.get<ApiResponse<Pregunta[]>>("/api/v1/autogestion/preguntas/");
  },

  consultarCensoEmpleado: async (cedula?: string): Promise<ApiResponse<CensoEmpleadoItem[]>> => {
    const url = cedula
      ? `/api/v1/autogestion/censo/consultar/${encodeURIComponent(cedula)}/`
      : `/api/v1/autogestion/censo/consultar/`;
    return apiClient.get<ApiResponse<CensoEmpleadoItem[]>>(url);
  },

  submitCensoVivienda: async (cedula: string, payload: SubmitPayload): Promise<ApiResponse<any>> => {
    return apiClient.post<ApiResponse<any>>(
      `/api/v1/autogestion/censo/${encodeURIComponent(cedula)}/`,
      payload as unknown as Record<string, unknown>,
    );
  },

  getReporteCensoDependencias: async (searchParams?: string): Promise<ApiResponse<ReporteCensoData>> => {
    const url = searchParams
      ? `/api/v1/autogestion/censo/reporte-dependencias/?${searchParams}`
      : `/api/v1/autogestion/censo/reporte-dependencias/`;
    return apiClient.get<ApiResponse<ReporteCensoData>>(url);
  },

  getMetricas: async (): Promise<ApiResponse<any>> => {
    return apiClient.get<ApiResponse<any>>("/api/v1/autogestion/censo/metricas/");
  },

  exportarCensoExcel: async (filtros?: any): Promise<Blob> => {
    return apiClient.postBlob("/api/v1/autogestion/censo/export/excel/", { filtros });
  },

  solicitarCarnet: async (payload: { motivo_id?: number; observaciones?: string }): Promise<ApiResponse<any>> => {
    return apiClient.post<ApiResponse<any>>("/api/v1/autogestion/solicitar-carnet/", payload as Record<string, unknown>);
  },

  descargarMiCarnetPdf: async (): Promise<Blob> => {
    return apiClient.getBlob("/api/v1/autogestion/mi-carnet/pdf/");
  },

  // Backward-compatibility aliases for existing repository tests
  getCensoDeEmpleado: async (cedula: string): Promise<RespuestaCensoApiItem[]> => {
    const res = await apiClient.get<ApiResponse<CensoEmpleadoItem[]>>(`/api/v1/autogestion/censo/consultar/${encodeURIComponent(cedula)}/`);
    const censo = res.data?.[0];
    if (!censo) return [];
    return (censo.preguntas || []).map((p) => ({
      id: p.id,
      pregunta_id: p.id,
      pregunta_enunciado: p.pregunta,
      empleado_cedula: censo.cedula,
      opcion_id: p.opcion?.id || null,
      opcion_texto: p.opcion?.opcion || null,
      respuesta_texto: p.respuesta,
    }));
  },

  registrarRespuestas: async (cedula: string, respuestas: Array<Record<string, unknown>>): Promise<RespuestaCensoApiItem[]> => {
    const formatted = respuestas.map((r) => ({
      pregunta: Number(r.pregunta_id || r.pregunta),
      opcion: r.opcion_id !== undefined ? (r.opcion_id as number | null) : (r.opcion as number | null) ?? null,
      respuesta: String(r.respuesta || r.respuesta_texto || ""),
    }));
    await autogestionApi.submitCensoVivienda(cedula, { carnet_patria: "", respuestas: formatted });
    return autogestionApi.getCensoDeEmpleado(cedula);
  },

  getReporteDependencias: async (): Promise<ReporteDependenciaApiItem[]> => {
    const res = await autogestionApi.getReporteCensoDependencias();
    const bar = res.data?.bar_chart || [];
    return bar.map((b, idx) => ({
      dependencia_id: idx + 1,
      dependencia: b.key,
      total_empleados: b.total,
      empleados_censados: b.respondidos,
    }));
  },

  getExcelCenso: async (): Promise<Blob> => {
    return autogestionApi.exportarCensoExcel();
  },

  // Catálogos para el formulario y filtros
  getStates: async (): Promise<ApiResponse<States[]>> => {
    return apiClient.get<ApiResponse<States[]>>("/api/v1/catalogos/estados/");
  },

  getMunicipalitys: async (estadoId: string | number): Promise<ApiResponse<Municipality[]>> => {
    return apiClient.get<ApiResponse<Municipality[]>>(`/api/v1/catalogos/municipios/?estado_id=${estadoId}`);
  },

  getParish: async (municipioId: string | number): Promise<ApiResponse<Parish[]>> => {
    return apiClient.get<ApiResponse<Parish[]>>(`/api/v1/catalogos/parroquias/?municipio_id=${municipioId}`);
  },

  getConditionDwelling: async (): Promise<ApiResponse<ConditionDwelling[]>> => {
    return apiClient.get<ApiResponse<ConditionDwelling[]>>("/api/v1/personal/catalogos/condiciones-vivienda/");
  },

  getCodigosPostales: async (estadoId: string | number): Promise<ApiResponse<CodigoPostal[]>> => {
    return apiClient.get<ApiResponse<CodigoPostal[]>>(`/api/v1/personal/catalogos/codigos-postales/?estado_id=${estadoId}`);
  },

  getDependency: async (): Promise<ApiResponse<DependenciaApiItem[]>> => {
    return apiClient.get<ApiResponse<DependenciaApiItem[]>>("/api/v1/organizacion/dependencias/");
  },

  getDirectionGeneralById: async (dependenciaId: string | number): Promise<ApiResponse<DireccionGeneralApiItem[]>> => {
    return apiClient.get<ApiResponse<DireccionGeneralApiItem[]>>(`/api/v1/organizacion/direcciones-generales/?dependencia_id=${dependenciaId}`);
  },

  getDirectionLine: async (dgId: string | number): Promise<ApiResponse<DireccionLineaApiItem[]>> => {
    return apiClient.get<ApiResponse<DireccionLineaApiItem[]>>(`/api/v1/organizacion/direcciones-linea/?direccion_general_id=${dgId}`);
  },

  getCoordination: async (dlId: string | number): Promise<ApiResponse<CoordinacionApiItem[]>> => {
    return apiClient.get<ApiResponse<CoordinacionApiItem[]>>(`/api/v1/organizacion/coordinaciones/?direccion_linea_id=${dlId}`);
  },

  getNominaGeneral: async (): Promise<ApiResponse<TipoNominaApiItem[]>> => {
    return apiClient.get<ApiResponse<TipoNominaApiItem[]>>("/api/v1/catalogos/tipos-nomina/");
  },
};
