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
  actor_nombre?: string;
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
  canal?: string;
  registrada_por?: string;
  registrada_por_cedula?: string;
  registrador_tambien_aprobo?: boolean;
  fecha_envio: string | null;
  fecha_validacion: string | null;
  sin_correo_alternativo?: boolean;
  justificacion_sin_correo?: string;
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

type Nombrado = Record<string, unknown>;

/** Ficha de solo lectura con el contrato de `autogestion/mi-expediente` (recortada). */
export interface FichaApi {
  empleado: {
    cedula?: string;
    nombres?: string;
    apellidos?: string;
    sexo_nombre?: string | null;
    fecha_nacimiento?: string | null;
    correo?: string | null;
    telefono_movil?: string | null;
    telefono_habitacion?: string | null;
    datos_vivienda?: {
      pais?: {
        id: number;
        nombre: string;
        codigo?: string;
        es_venezuela: boolean;
      } | null;
      pais_id?: number | null;
      pais_nombre?: string | null;
      pais_codigo?: string | null;
      pais_es_venezuela?: boolean | null;
      ciudad_region?: string | null;
      estado_id?: number | null;
      municipio_id?: number | null;
      estado_nombre?: string | null;
      municipio_nombre?: string | null;
      parroquia_nombre?: string | null;
      codigo_postal_nombre?: string | null;
      direccion_exacta?: string | null;
      condicion_vivienda_nombre?: string | null;
    } | null;
    contacto_emergencia?: Array<{
      id: number | string;
      nombres?: string;
      apellidos?: string;
      telefono?: string | null;
      relacion_nombre?: string | null;
    }>;
    antecedentes?: Array<Nombrado & { fecha_ingreso?: string | null; fecha_egreso?: string | null }>;
    asignaciones?: Array<{
      tipo_nomina?: string | null;
      denominacion_cargo?: string | null;
      dependencia?: string | null;
      direccion_general?: string | null;
      direccion_linea?: string | null;
      coordinacion?: string | null;
    }>;
  };
  familiares?: Array<{
    id: number | string;
    primer_nombre?: string;
    segundo_nombre?: string | null;
    primer_apellido?: string;
    segundo_apellido?: string | null;
    cedula_familiar?: string | null;
    parentesco_nombre?: string | null;
    fecha_nacimiento?: string | null;
  }>;
  datos_complementarios?: { correo_alternativo?: string | null; tiene_hijos?: boolean | null };
}

export interface DetalleRevisionApi extends DetalleApi {
  proceso_nombre?: string;
  ficha?: FichaApi | null;
  acciones_disponibles?: string[];
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
  guia_vista?: boolean;
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
  correo_alternativo?: string;
  alternativo_validado?: boolean;
  sin_correo: boolean;
  tiene_cuenta: boolean;
  canal?: string;
}

export interface ProcesoResumenEstadisticaApi {
  id: string;
  nombre: string;
  estado: string;
  apertura: string | null;
  cierre: string | null;
}

export interface KpisEstadisticaApi {
  total: number;
  respondieron: number;
  faltan: number;
  validadas: number;
  porcentaje_respondieron: number;
  porcentaje_faltan: number;
  porcentaje_validadas: number;
}

export interface FilaTipoEstadisticaApi {
  tipo_nomina_id: number | null;
  tipo_nomina: string;
  total: number;
  respondieron: number;
  faltan: number;
  validadas: number;
}

export interface FilaEstadoEstadisticaApi {
  estado: string;
  total: number;
}

export interface FilaCanalEstadisticaApi {
  canal: string;
  total: number;
}

export interface FilaMatrizEstadisticaApi {
  tipo_nomina_id: number | null;
  tipo_nomina: string;
  estado: string;
  total: number;
}

export interface EstadisticasApi {
  proceso: ProcesoResumenEstadisticaApi | null;
  procesos: ProcesoResumenEstadisticaApi[];
  tipos: TipoPensionApi[];
  kpis: KpisEstadisticaApi;
  por_tipo: FilaTipoEstadisticaApi[];
  por_estado: FilaEstadoEstadisticaApi[];
  por_canal: FilaCanalEstadisticaApi[];
  matriz: FilaMatrizEstadisticaApi[];
  filtros: {
    proceso_id: string | null;
    tipo_nomina_id: number | null;
    estado: string | null;
    canal: string | null;
    desde: string | null;
    hasta: string | null;
  };
}

export interface PasivoEstadisticaApi {
  cedula: string;
  nombre_completo: string;
  tipo_nomina: string;
  correo: string;
  telefono: string;
  estado: string;
  canal: string;
  fecha_envio: string | null;
}

export interface PasivoPresencialApi {
  cedula: string;
  nombre_completo: string;
  tipo_nomina: string;
  correo: string;
  tiene_cuenta: boolean;
  proceso_vigente: Record<string, unknown> | null;
  solicitud: SolicitudApi | null;
  constancia_numero: string | null;
  puede_iniciar: boolean;
  puede_continuar: boolean;
  puede_imprimir: boolean;
}

export interface InicioPresencialApi {
  solicitud: SolicitudApi;
  cambios: CambioApi[];
  ficha: Record<string, unknown>;
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

export interface CuerpoProceso {
  nombre: string;
  fecha_apertura: string;
  fecha_cierre: string;
  tipos_nomina: number[];
  dias_recordatorio: number[];
}

type Params = Record<string, string | number | boolean | undefined | null>;

export interface CertificanteApi {
  nombre: string;
  cedula: string;
  rol?: string;
}

/** Verificación pública (cédula enmascarada) o interna (completa, con certificantes y solicitud). */
export interface VerificacionApi {
  numero: string;
  emitida_en: string | null;
  proceso_nombre: string;
  nombre_completo: string;
  cedula?: string;
  cedula_enmascarada?: string;
  estado: string;
  solicitud_id?: string;
  certificada_por?: CertificanteApi[];
}

export interface ReenvioConstanciaApi {
  numero: string;
  destinatario: string;
  destinatario_enmascarado: string;
  copia: string | null;
  copia_enmascarada: string | null;
  reenvios_hoy: number;
  limite_diario: number;
}

export interface RegenerarConstanciaApi {
  numero: string;
  plantilla_version: number;
  reenviado: boolean;
  destinatario_enmascarado?: string | null;
  copia_enmascarada?: string | null;
  reenvios_hoy?: number | null;
}

export const feDeVidaApi = {
  vigente: () => apiClient.get<ApiResponse<VigenteApi | null>>(`${BASE}/procesos/vigente/`),
  marcarGuiaVista: (proceso_id: string) =>
    apiClient.post<ApiResponse<{ guia_vista: boolean }>>(`${BASE}/procesos/vigente/guia-vista/`, { proceso_id }),
  iniciar: () => apiClient.post<ApiResponse<SolicitudApi>>(`${BASE}/procesos/vigente/solicitud/`),
  misSolicitudes: (params: Params) =>
    apiClient.get<ApiResponse<PaginaApi<SolicitudApi>>>(`${BASE}/mis-solicitudes/`, { params }),
  miSolicitud: (id: string) =>
    apiClient.get<ApiResponse<DetalleApi>>(`${BASE}/mis-solicitudes/${id}/`),
  borrador: (
    id: string,
    cambios: unknown[],
    opciones?: { sinCorreoAlternativo?: boolean; justificacionSinCorreo?: string },
  ) =>
    apiClient.put<ApiResponse<DetalleApi>>(`${BASE}/mis-solicitudes/${id}/borrador/`, {
      cambios,
      ...(opciones
        ? {
            sin_correo_alternativo: opciones.sinCorreoAlternativo ?? false,
            justificacion_sin_correo: opciones.justificacionSinCorreo ?? "",
          }
        : {}),
    }),
  evidencia: (id: string, form: FormData) =>
    apiClient.postForm<ApiResponse<SolicitudApi>>(`${BASE}/mis-solicitudes/${id}/evidencia/`, form),
  enviar: (id: string) =>
    apiClient.post<ApiResponse<SolicitudApi>>(`${BASE}/mis-solicitudes/${id}/enviar/`),
  /** Sin sesión: la ficha que abre el QR del documento impreso. */
  verificacionPublica: (codigo: string) =>
    apiClient.get<ApiResponse<VerificacionApi>>(
      `${BASE}/constancias/publica/${encodeURIComponent(codigo)}/`,
      { skipAuth: true },
    ),
  verificacionInterna: (codigo: string) =>
    apiClient.get<ApiResponse<VerificacionApi>>(
      `${BASE}/constancias/verificar/${encodeURIComponent(codigo)}/`,
      // F2-04: se consulta desde el render de la página; no refrescar aquí
      // (no puede guardar cookies y Django ya habría rotado el refresh). Si el
      // access venció, el caso de uso cae a la vía pública.
      { sinRefresco: true },
    ),
  constancia: (id: string) => apiClient.getBlob(`${BASE}/mis-solicitudes/${id}/constancia/`),

  bandeja: (params: Params) =>
    apiClient.get<ApiResponse<PaginaApi<SolicitudApi>>>(`${BASE}/solicitudes/`, { params }),
  detalleRevision: (id: string) =>
    apiClient.get<ApiResponse<DetalleRevisionApi>>(`${BASE}/solicitudes/${id}/`),
  /** Bytes de la foto (Django los sirve por streaming; el almacén no se expone). */
  evidenciaImagen: (id: string) => apiClient.getBlob(`${BASE}/solicitudes/${id}/evidencia/`),
  check: (id: string) => apiClient.post<ApiResponse<SolicitudApi>>(`${BASE}/solicitudes/${id}/check/`),
  retirarCheck: (id: string, motivo: string) =>
    apiClient.post<ApiResponse<SolicitudApi>>(`${BASE}/solicitudes/${id}/retirar-check/`, { motivo }),
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
  reenviarConstancia: (id: string) =>
    apiClient.post<ApiResponse<ReenvioConstanciaApi>>(`${BASE}/solicitudes/${id}/reenviar-constancia/`),
  regenerarConstancia: (id: string, reenviar = false) =>
    apiClient.post<ApiResponse<RegenerarConstanciaApi>>(
      `${BASE}/solicitudes/${id}/regenerar-constancia/`,
      { reenviar },
    ),

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

  estadisticas: (params: Params) =>
    apiClient.get<ApiResponse<EstadisticasApi>>(`${BASE}/estadisticas/`, { params }),
  pasivosEstadistica: (params: Params) =>
    apiClient.get<ApiResponse<PaginaApi<PasivoEstadisticaApi>>>(
      `${BASE}/estadisticas/pasivos/`,
      { params },
    ),

  buscarPasivoPresencial: (params: Params) =>
    apiClient.get<ApiResponse<PaginaApi<PasivoPresencialApi>>>(`${BASE}/presencial/buscar/`, { params }),
  iniciarPresencial: (cedula: string) =>
    apiClient.post<ApiResponse<InicioPresencialApi>>(
      `${BASE}/presencial/solicitudes/`,
      { cedula },
    ),
  borradorPresencial: (
    id: string,
    cambios: unknown[],
    opciones: { sinCorreoAlternativo?: boolean; justificacionSinCorreo?: string } = {},
  ) =>
    apiClient.put<ApiResponse<DetalleApi>>(`${BASE}/presencial/solicitudes/${id}/borrador/`, {
      cambios,
      sin_correo_alternativo: opciones.sinCorreoAlternativo ?? false,
      justificacion_sin_correo: opciones.justificacionSinCorreo ?? "",
    }),
  evidenciaPresencial: (id: string, form: FormData) =>
    apiClient.postForm<ApiResponse<SolicitudApi>>(`${BASE}/presencial/solicitudes/${id}/evidencia/`, form),
  enviarPresencial: (id: string, declaracionPresencial = true) =>
    apiClient.post<ApiResponse<SolicitudApi>>(`${BASE}/presencial/solicitudes/${id}/enviar/`, {
      declaracion_presencial: declaracionPresencial,
    }),
  constanciaBienestar: (id: string) => apiClient.getBlob(`${BASE}/solicitudes/${id}/constancia/`),
};
