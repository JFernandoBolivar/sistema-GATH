/**
 * Cliente HTTP para Personal conectado a la API canónica /api/v1/personal/
 * (verificado contra `BACKEND/apps/personal/presentation/urls.py` +
 * `personal_serializers.py::EmpleadoSerializer` — Fase 1 del plan de
 * reparación). Los recursos identifican al empleado por cédula, no por id.
 *
 * Todas las respuestas llegan envueltas en el sobre C-1 (`ok()`); por eso
 * cada lectura/escritura desempaqueta `data`. También expone los catálogos
 * de soporte del expediente (vivienda, salud, académico, contrato...).
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

export interface EmpleadoApiItem {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  sexo_id: number;
  sexo_nombre: string;
  correo: string | null;
  telefono_movil: string | null;
  telefono_habitacion: string | null;
  fecha_nacimiento: string | null;
  estado_civil_id: number | null;
  estado_civil_nombre: string | null;
  carnet_patria: string | null;
  total_anos_apn: number;
  datos_vivienda: Record<string, unknown> | null;
  perfil_salud: Record<string, unknown> | null;
  perfil_fisico: Record<string, unknown> | null;
  formacion_academica: Record<string, unknown>[];
  formacion_complementaria: Record<string, unknown>[];
  contacto_emergencia: Record<string, unknown>[];
  antecedentes: Record<string, unknown>[];
  contrato_actual: Record<string, unknown> | null;
  contratos?: Record<string, unknown>[];
  asignaciones?: Record<string, unknown>[];
}

export interface CatalogoEmpleadoApiItem {
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

export const personalApi = {
  getEmpleados: (filtros?: { q?: string; busqueda?: string; codigo?: string; tipo_nomina?: string | number }) =>
    list<EmpleadoApiItem>(
      apiClient.get<ApiResponse<EmpleadoApiItem[]>>("/api/v1/personal/", { params: filtros as Record<string, string | number | undefined> }),
    ),

  getPorCedula: (cedula: string) =>
    single<EmpleadoApiItem>(
      apiClient.get<ApiResponse<EmpleadoApiItem>>(`/api/v1/personal/${cedula}/`),
    ),

  crear: (payload: Record<string, unknown>) =>
    single<EmpleadoApiItem>(
      apiClient.post<ApiResponse<EmpleadoApiItem>>("/api/v1/personal/", payload),
    ),

  actualizar: (cedula: string, payload: Record<string, unknown>) =>
    single<EmpleadoApiItem>(
      apiClient.put<ApiResponse<EmpleadoApiItem>>(`/api/v1/personal/${cedula}/`, payload),
    ),

  subirFoto: (cedula: string, formData: FormData) =>
    single<{ clave: string; url: string; mensaje: string }>(
      apiClient.post<ApiResponse<{ clave: string; url: string; mensaje: string }>>(
        `/api/v1/personal/${cedula}/foto/`,
        formData as unknown as Record<string, unknown>,
      ),
    ),

  // --- Catálogos de soporte del expediente (apps/personal/catalogos) ---
  getPoliticas: () =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/personal/catalogos/politicas/")),
  getCondicionesVivienda: () =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/personal/catalogos/condiciones-vivienda/")),
  getCodigosPostales: (estadoId?: number) =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/personal/catalogos/codigos-postales/", {
      params: estadoId ? { estado_id: estadoId } : undefined,
    })),
  getGruposSanguineos: () =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/personal/catalogos/grupos-sanguineos/")),
  getNivelesAcademicos: () =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/personal/catalogos/niveles-academicos/")),
  getCarreras: (nivelAcademicoId?: number) =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/personal/catalogos/carreras/", {
      params: nivelAcademicoId ? { nivel_academico_id: nivelAcademicoId } : undefined,
    })),
  getMenciones: (carreraId?: number) =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/personal/catalogos/menciones/", {
      params: carreraId ? { carrera_id: carreraId } : undefined,
    })),
  getInstituciones: () =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/personal/catalogos/instituciones/")),
  getTiposPrenda: () =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/personal/catalogos/tipos-prenda/")),
  getRegionesTalla: () =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/personal/catalogos/regiones-talla/")),
  getTallas: (tipoPrendaId?: number) =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/personal/catalogos/tallas/", {
      params: tipoPrendaId ? { tipo_prenda_id: tipoPrendaId } : undefined,
    })),
  getCapacitaciones: () =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/personal/catalogos/capacitaciones/")),
  getGruposCapacitacion: () =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/personal/catalogos/grupos-capacitacion/")),
  getAlergias: () =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/personal/catalogos/alergias/")),
  getPatologias: () =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/personal/catalogos/patologias/")),
  getDiscapacidades: () =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/personal/catalogos/discapacidades/")),

  // --- Geografía y procedencia (apps/catalogos) ---
  getEstados: () =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/catalogos/estados/")),
  getMunicipios: (estadoId?: number) =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/catalogos/municipios/", {
      params: estadoId ? { estado_id: estadoId } : undefined,
    })),
  getParroquias: (municipioId?: number) =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/catalogos/parroquias/", {
      params: municipioId ? { municipio_id: municipioId } : undefined,
    })),
  getTiposProcedencia: () =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/catalogos/tipos-procedencia/")),
  getTiposNomina: () =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/catalogos/tipos-nomina/")),
  getSexos: () =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/catalogos/sexos/")),
  getEstadosCiviles: () =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/catalogos/estados-civiles/")),
  getOrganismosAdscritos: () =>
    list<CatalogoEmpleadoApiItem>(apiClient.get<ApiResponse<CatalogoEmpleadoApiItem[]>>("/api/v1/organizacion/organismos-adscritos/")),
};
