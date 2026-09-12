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
  getTiposPrenda: () => apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/tipos-prenda/"),
  getRegionesTalla: () => apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/regiones-talla/"),
  getTallas: (tipoPrendaId?: number) =>
    apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/tallas/", {
      params: tipoPrendaId ? { tipo_prenda_id: tipoPrendaId } : undefined,
    }),
  getCapacitaciones: () => apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/capacitaciones/"),
  getGruposCapacitacion: () => apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/grupos-capacitacion/"),
  getAlergias: () => apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/alergias/"),
  getPatologias: () => apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/patologias/"),
  getDiscapacidades: () => apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/discapacidades/"),

  // Escritura / CRUD para catálogos de soporte
  crearAlergia: (data: { alergia: string; categoria_id: number }) =>
    apiClient.post<CatalogoApiItem>("/api/v1/personal/catalogos/alergias/", data),
  eliminarAlergia: (id: number) =>
    apiClient.delete<void>(`/api/v1/personal/catalogos/alergias/${id}/`),

  getCategoriasAlergia: () =>
    apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/alergias/categorias/"),
  crearCategoriaAlergia: (data: { nombre_categoria: string }) =>
    apiClient.post<CatalogoApiItem>("/api/v1/personal/catalogos/alergias/categorias/", data),
  eliminarCategoriaAlergia: (id: number) =>
    apiClient.delete<void>(`/api/v1/personal/catalogos/alergias/categorias/${id}/`),

  crearPatologia: (data: { patologia: string; categoria_id: number }) =>
    apiClient.post<CatalogoApiItem>("/api/v1/personal/catalogos/patologias/", data),
  eliminarPatologia: (id: number) =>
    apiClient.delete<void>(`/api/v1/personal/catalogos/patologias/${id}/`),

  getCategoriasPatologia: () =>
    apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/patologias/categorias/"),
  crearCategoriaPatologia: (data: { nombre_categoria: string }) =>
    apiClient.post<CatalogoApiItem>("/api/v1/personal/catalogos/patologias/categorias/", data),
  eliminarCategoriaPatologia: (id: number) =>
    apiClient.delete<void>(`/api/v1/personal/catalogos/patologias/categorias/${id}/`),

  crearDiscapacidad: (data: { discapacidad: string; categoria_id: number }) =>
    apiClient.post<CatalogoApiItem>("/api/v1/personal/catalogos/discapacidades/", data),
  eliminarDiscapacidad: (id: number) =>
    apiClient.delete<void>(`/api/v1/personal/catalogos/discapacidades/${id}/`),

  getCategoriasDiscapacidad: () =>
    apiClient.get<CatalogoApiItem[]>("/api/v1/personal/catalogos/discapacidades/categorias/"),
  crearCategoriaDiscapacidad: (data: { nombre_categoria: string }) =>
    apiClient.post<CatalogoApiItem>("/api/v1/personal/catalogos/discapacidades/categorias/", data),
  eliminarCategoriaDiscapacidad: (id: number) =>
    apiClient.delete<void>(`/api/v1/personal/catalogos/discapacidades/categorias/${id}/`),

  crearTalla: (data: { valor: string; region_id: number; tipo_prenda_id: number }) =>
    apiClient.post<CatalogoApiItem>("/api/v1/personal/catalogos/tallas/", data),
  eliminarTalla: (id: number) =>
    apiClient.delete<void>(`/api/v1/personal/catalogos/tallas/${id}/`),

  crearRegionTalla: (data: { codigo: string; descripcion?: string | null }) =>
    apiClient.post<CatalogoApiItem>("/api/v1/personal/catalogos/regiones-talla/", data),
  eliminarRegionTalla: (id: number) =>
    apiClient.delete<void>(`/api/v1/personal/catalogos/regiones-talla/${id}/`),

  crearTipoPrenda: (data: { categoria: string }) =>
    apiClient.post<CatalogoApiItem>("/api/v1/personal/catalogos/tipos-prenda/", data),
  eliminarTipoPrenda: (id: number) =>
    apiClient.delete<void>(`/api/v1/personal/catalogos/tipos-prenda/${id}/`),
};
