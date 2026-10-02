/**
 * Cliente HTTP para Catálogos conectado a las APIs canónicas /api/v1/catalogos/
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

export interface CatalogoApiItem {
  id: number;
  nombre: string;
}

export interface EstadoApiItem {
  id: number;
  nombre: string;
  region_id: number;
}

export interface MunicipioApiItem {
  id: number;
  nombre: string;
  estado_id: number;
}

export interface ParroquiaApiItem {
  id: number;
  nombre: string;
  municipio_id: number;
}

async function list<T>(getter: Promise<ApiResponse<T[]> | T[]>): Promise<T[]> {
  const envelope = await getter;
  if (Array.isArray(envelope)) return envelope;
  return (envelope as ApiResponse<T[]>)?.data ?? [];
}

async function single<T>(getter: Promise<ApiResponse<T> | T>): Promise<T> {
  const envelope = await getter;
  if (envelope && typeof envelope === "object" && "data" in envelope) {
    return (envelope as ApiResponse<T>).data;
  }
  return envelope as T;
}

export const catalogosApi = {
  getRegiones: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/catalogos/regiones/"),
    ),

  getEstados: (regionId?: number) =>
    list<EstadoApiItem>(
      apiClient.get<ApiResponse<EstadoApiItem[]> | EstadoApiItem[]>("/api/v1/catalogos/estados/", {
        params: regionId ? { region_id: regionId } : undefined,
      }),
    ),

  getMunicipios: (estadoId?: number) =>
    list<MunicipioApiItem>(
      apiClient.get<ApiResponse<MunicipioApiItem[]> | MunicipioApiItem[]>("/api/v1/catalogos/municipios/", {
        params: estadoId ? { estado_id: estadoId } : undefined,
      }),
    ),

  getParroquias: (municipioId?: number) =>
    list<ParroquiaApiItem>(
      apiClient.get<ApiResponse<ParroquiaApiItem[]> | ParroquiaApiItem[]>("/api/v1/catalogos/parroquias/", {
        params: municipioId ? { municipio_id: municipioId } : undefined,
      }),
    ),

  getSexos: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/catalogos/sexos/"),
    ),
  getEstatus: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/catalogos/estatus/"),
    ),
  getTiposPersonal: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/catalogos/tipos-personal/"),
    ),
  getTiposNomina: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/catalogos/tipos-nomina/"),
    ),
  getParentescos: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/catalogos/parentescos/"),
    ),
  getTiposProcedencia: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/catalogos/tipos-procedencia/"),
    ),
  getGrados: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/catalogos/grados/"),
    ),
  getCategoriasMovimiento: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/catalogos/categorias-movimiento/"),
    ),
  getTiposMovimiento: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/catalogos/tipos-movimiento/"),
    ),
  getEstadosCiviles: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/catalogos/estados-civiles/"),
    ),

  // Catálogos de soporte del expediente de personal (apps/personal)
  getPoliticas: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/politicas/"),
    ),
  getCondicionesVivienda: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/condiciones-vivienda/"),
    ),
  getCodigosPostales: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/codigos-postales/"),
    ),
  getGruposSanguineos: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/grupos-sanguineos/"),
    ),
  getNivelesAcademicos: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/niveles-academicos/"),
    ),
  getCarreras: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/carreras/"),
    ),
  getMenciones: (carreraId?: number) =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/menciones/", {
        params: carreraId ? { carrera_id: carreraId } : undefined,
      }),
    ),
  getInstituciones: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/instituciones/"),
    ),
  getTiposPrenda: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/tipos-prenda/"),
    ),
  getRegionesTalla: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/regiones-talla/"),
    ),
  getTallas: (tipoPrendaId?: number) =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/tallas/", {
        params: tipoPrendaId ? { tipo_prenda_id: tipoPrendaId } : undefined,
      }),
    ),
  getCapacitaciones: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/capacitaciones/"),
    ),
  getGruposCapacitacion: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/grupos-capacitacion/"),
    ),
  getAlergias: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/alergias/"),
    ),
  getPatologias: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/patologias/"),
    ),
  getDiscapacidades: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/discapacidades/"),
    ),

  // Escritura / CRUD para catálogos de soporte
  crearAlergia: (data: { alergia: string; categoria_id: number }) =>
    single<CatalogoApiItem>(
      apiClient.post<ApiResponse<CatalogoApiItem> | CatalogoApiItem>("/api/v1/personal/catalogos/alergias/", data),
    ),
  eliminarAlergia: (id: number) =>
    apiClient.delete<void>(`/api/v1/personal/catalogos/alergias/${id}/`),

  getCategoriasAlergia: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/alergias/categorias/"),
    ),
  crearCategoriaAlergia: (data: { nombre_categoria: string }) =>
    single<CatalogoApiItem>(
      apiClient.post<ApiResponse<CatalogoApiItem> | CatalogoApiItem>("/api/v1/personal/catalogos/alergias/categorias/", data),
    ),
  eliminarCategoriaAlergia: (id: number) =>
    apiClient.delete<void>(`/api/v1/personal/catalogos/alergias/categorias/${id}/`),

  crearPatologia: (data: { patologia: string; categoria_id: number }) =>
    single<CatalogoApiItem>(
      apiClient.post<ApiResponse<CatalogoApiItem> | CatalogoApiItem>("/api/v1/personal/catalogos/patologias/", data),
    ),
  eliminarPatologia: (id: number) =>
    apiClient.delete<void>(`/api/v1/personal/catalogos/patologias/${id}/`),

  getCategoriasPatologia: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/patologias/categorias/"),
    ),
  crearCategoriaPatologia: (data: { nombre_categoria: string }) =>
    single<CatalogoApiItem>(
      apiClient.post<ApiResponse<CatalogoApiItem> | CatalogoApiItem>("/api/v1/personal/catalogos/patologias/categorias/", data),
    ),
  eliminarCategoriaPatologia: (id: number) =>
    apiClient.delete<void>(`/api/v1/personal/catalogos/patologias/categorias/${id}/`),

  crearDiscapacidad: (data: { discapacidad: string; categoria_id: number }) =>
    single<CatalogoApiItem>(
      apiClient.post<ApiResponse<CatalogoApiItem> | CatalogoApiItem>("/api/v1/personal/catalogos/discapacidades/", data),
    ),
  eliminarDiscapacidad: (id: number) =>
    apiClient.delete<void>(`/api/v1/personal/catalogos/discapacidades/${id}/`),

  getCategoriasDiscapacidad: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/personal/catalogos/discapacidades/categorias/"),
    ),
  crearCategoriaDiscapacidad: (data: { nombre_categoria: string }) =>
    single<CatalogoApiItem>(
      apiClient.post<ApiResponse<CatalogoApiItem> | CatalogoApiItem>("/api/v1/personal/catalogos/discapacidades/categorias/", data),
    ),
  eliminarCategoriaDiscapacidad: (id: number) =>
    apiClient.delete<void>(`/api/v1/personal/catalogos/discapacidades/categorias/${id}/`),

  crearTalla: (data: { valor: string; region_id: number; tipo_prenda_id: number }) =>
    single<CatalogoApiItem>(
      apiClient.post<ApiResponse<CatalogoApiItem> | CatalogoApiItem>("/api/v1/personal/catalogos/tallas/", data),
    ),
  eliminarTalla: (id: number) =>
    apiClient.delete<void>(`/api/v1/personal/catalogos/tallas/${id}/`),

  crearRegionTalla: (data: { codigo: string; descripcion?: string | null }) =>
    single<CatalogoApiItem>(
      apiClient.post<ApiResponse<CatalogoApiItem> | CatalogoApiItem>("/api/v1/personal/catalogos/regiones-talla/", data),
    ),
  eliminarRegionTalla: (id: number) =>
    apiClient.delete<void>(`/api/v1/personal/catalogos/regiones-talla/${id}/`),

  crearTipoPrenda: (data: { categoria: string }) =>
    single<CatalogoApiItem>(
      apiClient.post<ApiResponse<CatalogoApiItem> | CatalogoApiItem>("/api/v1/personal/catalogos/tipos-prenda/", data),
    ),
  eliminarTipoPrenda: (id: number) =>
    apiClient.delete<void>(`/api/v1/personal/catalogos/tipos-prenda/${id}/`),

  // Organismos adscritos (/api/v1/organizacion/organismos-adscritos/)
  getOrganismosAdscritos: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]> | CatalogoApiItem[]>("/api/v1/organizacion/organismos-adscritos/"),
    ),
  crearOrganismoAdscrito: (data: { nombre: string; parent_id?: number | null }) =>
    single<CatalogoApiItem>(
      apiClient.post<ApiResponse<CatalogoApiItem> | CatalogoApiItem>("/api/v1/organizacion/organismos-adscritos/crear/", data),
    ),
  actualizarOrganismoAdscrito: (id: number, data: { nombre: string; parent_id?: number | null }) =>
    single<CatalogoApiItem>(
      apiClient.put<ApiResponse<CatalogoApiItem> | CatalogoApiItem>(`/api/v1/organizacion/organismos-adscritos/${id}/`, data),
    ),
  eliminarOrganismoAdscrito: (id: number) =>
    apiClient.delete<void>(`/api/v1/organizacion/organismos-adscritos/${id}/eliminar/`),
};
