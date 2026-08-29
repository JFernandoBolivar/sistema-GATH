/**
 * Cliente HTTP para Catálogos conectado a las APIs canónicas /api/v1/catalogos/
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";

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

export const catalogosApi = {
  getRegiones: () => apiClient.get<CatalogoApiItem[]>("/api/v1/catalogos/regiones/"),

  getEstados: (regionId?: number) =>
    apiClient.get<EstadoApiItem[]>("/api/v1/catalogos/estados/", {
      params: regionId ? { region_id: regionId } : undefined,
    }),

  getMunicipios: (estadoId?: number) =>
    apiClient.get<MunicipioApiItem[]>("/api/v1/catalogos/municipios/", {
      params: estadoId ? { estado_id: estadoId } : undefined,
    }),

  getParroquias: (municipioId?: number) =>
    apiClient.get<ParroquiaApiItem[]>("/api/v1/catalogos/parroquias/", {
      params: municipioId ? { municipio_id: municipioId } : undefined,
    }),

  getSexos: () => apiClient.get<CatalogoApiItem[]>("/api/v1/catalogos/sexos/"),
  getEstatus: () => apiClient.get<CatalogoApiItem[]>("/api/v1/catalogos/estatus/"),
  getTiposPersonal: () => apiClient.get<CatalogoApiItem[]>("/api/v1/catalogos/tipos-personal/"),
  getTiposNomina: () => apiClient.get<CatalogoApiItem[]>("/api/v1/catalogos/tipos-nomina/"),
  getParentescos: () => apiClient.get<CatalogoApiItem[]>("/api/v1/catalogos/parentescos/"),
  getTiposProcedencia: () => apiClient.get<CatalogoApiItem[]>("/api/v1/catalogos/tipos-procedencia/"),
  getGrados: () => apiClient.get<CatalogoApiItem[]>("/api/v1/catalogos/grados/"),
  getCategoriasMovimiento: () => apiClient.get<CatalogoApiItem[]>("/api/v1/catalogos/categorias-movimiento/"),
  getTiposMovimiento: () => apiClient.get<CatalogoApiItem[]>("/api/v1/catalogos/tipos-movimiento/"),
  getEstadosCiviles: () => apiClient.get<CatalogoApiItem[]>("/api/v1/catalogos/estados-civiles/"),

  // Catálogos de soporte del expediente de personal (apps/personal)
  getPoliticas: () => apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/politicas/"),
  getCondicionesVivienda: () =>
    apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/condiciones-vivienda/"),
  getCodigosPostales: () =>
    apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/codigos-postales/"),
  getGruposSanguineos: () =>
    apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/grupos-sanguineos/"),
  getNivelesAcademicos: () =>
    apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/niveles-academicos/"),
  getCarreras: () => apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/carreras/"),
  getMenciones: (carreraId?: number) =>
    apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/menciones/", {
      params: carreraId ? { carrera_id: carreraId } : undefined,
    }),
  getInstituciones: () => apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/instituciones/"),
};
