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
  fecha_egreso: string | null;
  resolucion: string | null;
  observaciones: string | null;
  datos_vivienda: Record<string, unknown> | null;
  perfil_salud: Record<string, unknown> | null;
  perfil_fisico: Record<string, unknown> | null;
  formacion_academica: Record<string, unknown>[];
  contacto_emergencia: Record<string, unknown>[];
  antecedentes: Record<string, unknown>[];
  contrato_actual: Record<string, unknown> | null;
  cargos_historial: Record<string, unknown>[];
}

export interface ProcesarEgresoApiBody {
  motivo_movimiento_id: number;
  tipo_nomina_id: number;
  liberar_activos: boolean;
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
  getPasivos: (busqueda?: string) =>
    list<PasivoApiItem>(
      apiClient.get<ApiResponse<PasivoApiItem[]>>("/api/v1/pasivos/", {
        params: busqueda ? { q: busqueda } : undefined,
      }),
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

  getMotivosEgreso: () =>
    list<CatalogoPasivoApiItem>(
      apiClient.get<ApiResponse<CatalogoPasivoApiItem[]>>("/api/v1/catalogos/tipos-movimiento/", {
        params: { categoria: "EGRESO" },
      }),
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
