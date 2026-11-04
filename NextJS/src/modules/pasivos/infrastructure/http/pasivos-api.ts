/**
 * Cliente HTTP para Pasivos conectado a la API canónica /api/v1/pasivos/.
 * Todas las respuestas llegan envueltas en el sobre C-1 (`ok()`); por eso cada
 * lectura/escritura desempaqueta `data` antes de devolver el resultado (mismo
 * patrón que `cargos-api.ts`). Además provee los catálogos que el formulario
 * de egreso necesita (motivos de egreso y tipos de nómina).
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

export interface PasivoApiItem {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  tipo_pasivo: string;
  tipo_nomina_id: number | null;
  fecha_egreso: string | null;
  resolucion: string | null;
  observaciones: string | null;
  correo: string | null;
  telefono_movil: string | null;
  telefono_habitacion: string | null;
  carnet_patria: string | null;
  carnet_patria_serial: string | null;
  fecha_nacimiento: string | null;
  sexo_nombre?: string | null;
  fecha_ingreso_organismo?: string | null;
  estado_civil_id: number | null;
  nacionalidad_id: number | null;
  datos_vivienda: Record<string, unknown> | null;
  perfil_salud: Record<string, unknown> | null;
  perfil_fisico: Record<string, unknown> | null;
  formacion_academica: Record<string, unknown>[];
  contacto_emergencia: Record<string, unknown>[];
  antecedentes: Record<string, unknown>[];
  contrato_actual: Record<string, unknown> | null;
  cargos_historial: Record<string, unknown>[];
}

export interface PaginaPasivosApi {
  count: number;
  limit: number;
  offset: number;
  results: PasivoApiItem[];
}

export interface FiltrosPasivosApi {
  cedula?: string;
  nombre?: string;
  codigo?: string;
  tipo_nomina_id?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  limit?: number;
  offset?: number;
}

export interface ActualizarPasivoApiBody {
  nombres?: string;
  apellidos?: string;
  correo?: string | null;
  telefono_movil?: string | null;
  telefono_habitacion?: string | null;
  carnet_patria?: string | null;
  carnet_patria_serial?: string | null;
  fecha_nacimiento?: string | null;
  estado_civil_id?: number | null;
  nacionalidad_id?: number | null;
}

export interface RegistrarPasivoApiBody {
  cedula: string;
  nombres: string;
  apellidos: string;
  sexo_id: number;
  fecha_nacimiento: string;
  tipo_nomina_id: number;
  estado_civil_id?: number | null;
  nacionalidad_id?: number | null;
  correo?: string | null;
  telefono_movil?: string | null;
  telefono_habitacion?: string | null;
  carnet_patria?: string | null;
  carnet_patria_serial?: string | null;
  datos_vivienda?: Record<string, unknown>;
  perfil_salud?: Record<string, unknown>;
  perfil_fisico?: Record<string, unknown>;
  formacion_academica?: Record<string, unknown>[];
  formacion_complementaria?: Record<string, unknown>[];
  contacto_emergencia?: Record<string, unknown>[];
  antecedentes?: Record<string, unknown>[];
}

export interface ProcesarEgresoApiBody {
  motivo_movimiento_id: number;
  tipo_nomina_id: number;
  liberar_activos: boolean;
}

export interface FamiliarTitularApiItem {
  id: number;
  cedula_familiar: string | null;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  heredero: boolean;
}

export interface ResultadoSobrevivienteApiItem {
  cedula: string;
  nombre_completo: string;
  creado: boolean;
  codigo_asignacion: string | null;
}

export interface CatalogoPasivoApiItem {
  id: number;
  nombre: string;
}

async function list<T>(getter: Promise<ApiResponse<T[]>>): Promise<T[]> {
  const envelope = await getter;
  return envelope.data ?? [];
}

async function single<T>(getter: Promise<ApiResponse<T>>): Promise<T> {
  const envelope = await getter;
  return envelope.data;
}

export const pasivosApi = {
  getPasivos: (filtros: FiltrosPasivosApi = {}) =>
    apiClient.get<ApiResponse<PaginaPasivosApi>>("/api/v1/pasivos/", {
      params: {
        cedula: filtros.cedula,
        nombre: filtros.nombre,
        codigo: filtros.codigo,
        tipo_nomina_id: filtros.tipo_nomina_id,
        fecha_desde: filtros.fecha_desde,
        fecha_hasta: filtros.fecha_hasta,
        limit: filtros.limit,
        offset: filtros.offset,
      },
    }),

  crear: (body: RegistrarPasivoApiBody) =>
    single<PasivoApiItem>(
      apiClient.post<ApiResponse<PasivoApiItem>>(
        "/api/v1/pasivos/",
        body as unknown as Record<string, unknown>,
      ),
    ),

  actualizar: (cedula: string, body: ActualizarPasivoApiBody) =>
    single<PasivoApiItem>(
      apiClient.patch<ApiResponse<PasivoApiItem>>(
        `/api/v1/pasivos/${cedula}/`,
        body as unknown as Record<string, unknown>,
      ),
    ),

  getPorCedula: (cedula: string) =>
    single<PasivoApiItem>(
      apiClient.get<ApiResponse<PasivoApiItem>>(`/api/v1/pasivos/${cedula}/`),
    ),

  getPdf: (cedula: string) => apiClient.getBlob(`/api/v1/pasivos/${cedula}/pdf/`),

  procesarEgreso: (cedula: string, body: ProcesarEgresoApiBody) =>
    single<PasivoApiItem>(
      apiClient.post<ApiResponse<PasivoApiItem>>(`/api/v1/pasivos/${cedula}/procesar-egreso/`, body as unknown as Record<string, unknown>),
    ),

  getFamiliaresTitular: (cedula: string) =>
    list<FamiliarTitularApiItem>(
      apiClient.get<ApiResponse<FamiliarTitularApiItem[]>>(`/api/v1/familiares/empleado/${cedula}/`),
    ),

  registrarSobrevivientes: (cedula: string, familiarIds: number[]) =>
    list<ResultadoSobrevivienteApiItem>(
      apiClient.post<ApiResponse<ResultadoSobrevivienteApiItem[]>>(
        `/api/v1/pasivos/${cedula}/sobrevivientes/`,
        { familiar_ids: familiarIds },
      ),
    ),

  egresarPasivo: (cedula: string, motivoId: number, familiarIds: number[]) =>
    single<PasivoApiItem>(
      apiClient.post<ApiResponse<PasivoApiItem>>(
        `/api/v1/pasivos/${cedula}/egreso/`,
        { motivo_id: motivoId, sobrevivientes_familiar_ids: familiarIds },
      ),
    ),

  getTiposNomina: (soloPasivos: boolean = true) =>
    list<CatalogoPasivoApiItem>(
      apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/catalogos/tipos-nomina/", {
        params: soloPasivos ? { solo_pasivos: true } : undefined,
      }),
    ),

  // --- Catálogos del expediente (vista de detalle) ---
  // Mismos endpoints que consume `modules/personal` para el mismo contrato
  // de expediente compartido; se llaman aquí directamente (sin importar el
  // módulo hermano) porque son rutas de backend públicas, no código frontend.
  getSexos: () =>
    list<CatalogoPasivoApiItem>(apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/catalogos/sexos/")),
  getEstadosCiviles: () =>
    list<CatalogoPasivoApiItem>(apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/catalogos/estados-civiles/")),
  getNacionalidades: () =>
    list<CatalogoPasivoApiItem>(apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/catalogos/nacionalidades/")),
  getEstados: () =>
    list<CatalogoPasivoApiItem>(apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/catalogos/estados/")),
  getMunicipios: () =>
    list<CatalogoPasivoApiItem>(apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/catalogos/municipios/")),
  getParroquias: () =>
    list<CatalogoPasivoApiItem>(apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/catalogos/parroquias/")),
  getCondicionesVivienda: () =>
    list<CatalogoPasivoApiItem>(apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/personal/catalogos/condiciones-vivienda/")),
  getCodigosPostales: () =>
    list<CatalogoPasivoApiItem>(apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/personal/catalogos/codigos-postales/")),
  getGruposSanguineos: () =>
    list<CatalogoPasivoApiItem>(apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/personal/catalogos/grupos-sanguineos/")),
  getAlergias: () =>
    list<CatalogoPasivoApiItem>(apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/personal/catalogos/alergias/")),
  getPatologias: () =>
    list<CatalogoPasivoApiItem>(apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/personal/catalogos/patologias/")),
  getDiscapacidades: () =>
    list<CatalogoPasivoApiItem>(apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/personal/catalogos/discapacidades/")),
  getTallas: () =>
    list<CatalogoPasivoApiItem>(apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/personal/catalogos/tallas/")),
  getNivelesAcademicos: () =>
    list<CatalogoPasivoApiItem>(apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/personal/catalogos/niveles-academicos/")),
  getCarreras: () =>
    list<CatalogoPasivoApiItem>(apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/personal/catalogos/carreras/")),
  getMenciones: () =>
    list<CatalogoPasivoApiItem>(apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/personal/catalogos/menciones/")),
  getInstituciones: () =>
    list<CatalogoPasivoApiItem>(apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/personal/catalogos/instituciones/")),
  getPoliticas: () =>
    list<CatalogoPasivoApiItem>(apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/personal/catalogos/politicas/")),
};
