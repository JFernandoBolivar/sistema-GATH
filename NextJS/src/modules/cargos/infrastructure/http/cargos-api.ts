/**
 * Cliente HTTP para Cargos conectado a las APIs canónicas /api/v1/cargos/.
 * Todas las respuestas llegan envueltas en el sobre C-1 (`ok()`); por eso cada
 * lectura desempaqueta `data` antes de devolver el listado.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

export interface CargoApiItem {
  id: number;
  codigo: string;
  empleado_cedula: string | null;
  denominacion_id: number;
  denominacion_nombre: string;
  especifica_id: number;
  especifica_nombre: string;
  tipo_nomina_id: number;
  tipo_nomina_nombre: string;
  estatus_id: number;
  estatus_nombre: string;
  dependencia_id: number | null;
  dependencia_nombre: string | null;
  direccion_general_id: number | null;
  direccion_general_nombre: string | null;
  direccion_linea_id: number | null;
  direccion_linea_nombre: string | null;
  coordinacion_id: number | null;
  coordinacion_nombre: string | null;
  observaciones: string | null;
  esta_vacante: boolean;
}

export interface DenominacionApiItem {
  id: number;
  nombre: string;
  orden: number;
}

export interface PrestamoApiItem {
  id: number;
  empleado_encargado_cedula: string;
  empleado_encargado_nombre: string;
  cargo_encargado_id: number;
  cargo_encargado_codigo: string;
  titular_cedula: string | null;
  titular_nombre: string | null;
  motivo_id: number;
  motivo_nombre: string;
  estatus_id: number;
  estatus_nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  ejecutado_por_id: number;
  esta_finalizada: boolean;
}

export interface CatalogoApiItem {
  id: number;
  nombre: string;
}

export interface UnidadOrganizativaApiItem {
  id: number;
  codigo: string;
  nombre: string;
}

export type CrearCargoBody = {
  denominacion_id: number;
  especifica_id: number;
  tipo_nomina_id: number;
  dependencia_id?: number;
  direccion_general_id?: number;
  direccion_linea_id?: number;
  coordinacion_id?: number;
  organismo_id?: number;
  grado_id?: number;
  observaciones?: string;
};

export type DenominacionWriteBody = {
  nombre: string;
  orden: number;
};

export type CrearPrestamoBody = {
  cedula_encargado: string;
  cargo_id: number;
  motivo_id: number;
  fecha_inicio: string;
  fecha_fin: string;
};

export type CambiarCargoBody = {
  cargo_nuevo_id: number;
  motivo_id: number;
};

export type GestionarEstatusBody = {
  estatus_id: number;
  motivo_id: number;
};

async function list<T>(getPromise: Promise<ApiResponse<T[]>>): Promise<T[]> {
  const envelope = await getPromise;
  return envelope.data ?? [];
}

async function single<T>(getPromise: Promise<ApiResponse<T>>): Promise<T> {
  const envelope = await getPromise;
  return envelope.data;
}

export const cargosApi = {
  getCargos: (filtros?: { dependencia_id?: number; solo_vacantes?: boolean }) =>
    list<CargoApiItem>(
      apiClient.get<ApiResponse<CargoApiItem[]>>("/api/v1/cargos/", { params: filtros }),
    ),

  getVacantes: (filtros?: { dependencia_id?: number }) =>
    list<CargoApiItem>(
      apiClient.get<ApiResponse<CargoApiItem[]>>("/api/v1/cargos/vacantes/", { params: filtros }),
    ),

  getDenominaciones: () =>
    list<DenominacionApiItem>(
      apiClient.get<ApiResponse<DenominacionApiItem[]>>("/api/v1/cargos/denominaciones/"),
    ),

  getDenominacionesEspecificas: () =>
    list<DenominacionApiItem>(
      apiClient.get<ApiResponse<DenominacionApiItem[]>>("/api/v1/cargos/denominaciones-especificas/"),
    ),

  crearDenominacion: (body: DenominacionWriteBody) =>
    single<DenominacionApiItem>(
      apiClient.post<ApiResponse<DenominacionApiItem>>("/api/v1/cargos/denominaciones/crear/", body),
    ),

  actualizarDenominacion: (id: number, body: DenominacionWriteBody) =>
    single<DenominacionApiItem>(
      apiClient.put<ApiResponse<DenominacionApiItem>>(`/api/v1/cargos/denominaciones/${id}/`, body),
    ),

  eliminarDenominacion: (id: number) =>
    apiClient.delete<ApiResponse<null>>(`/api/v1/cargos/denominaciones/${id}/eliminar/`),

  crearDenominacionEspecifica: (body: DenominacionWriteBody) =>
    single<DenominacionApiItem>(
      apiClient.post<ApiResponse<DenominacionApiItem>>("/api/v1/cargos/denominaciones-especificas/crear/", body),
    ),

  actualizarDenominacionEspecifica: (id: number, body: DenominacionWriteBody) =>
    single<DenominacionApiItem>(
      apiClient.put<ApiResponse<DenominacionApiItem>>(`/api/v1/cargos/denominaciones-especificas/${id}/`, body),
    ),

  eliminarDenominacionEspecifica: (id: number) =>
    apiClient.delete<ApiResponse<null>>(`/api/v1/cargos/denominaciones-especificas/${id}/eliminar/`),

  asignar: (cargoId: number, empleadoCedula: string) =>
    single<CargoApiItem>(
      apiClient.post<ApiResponse<CargoApiItem>>(`/api/v1/cargos/${cargoId}/asignar/`, {
        cedula: empleadoCedula,
      }),
    ),

  desasignar: (cargoId: number) =>
    single<CargoApiItem>(
      apiClient.post<ApiResponse<CargoApiItem>>(`/api/v1/cargos/${cargoId}/desasignar/`, {}),
    ),

  cambiarCargo: (cargoActualId: number, body: CambiarCargoBody) =>
    single<CargoApiItem>(
      apiClient.post<ApiResponse<CargoApiItem>>(`/api/v1/cargos/${cargoActualId}/cambiar/`, body),
    ),

  gestionarEstatus: (cargoId: number, body: GestionarEstatusBody) =>
    single<CargoApiItem>(
      apiClient.post<ApiResponse<CargoApiItem>>(`/api/v1/cargos/${cargoId}/estatus/`, body),
    ),

  getPrestamos: (soloActivos?: boolean) =>
    list<PrestamoApiItem>(
      apiClient.get<ApiResponse<PrestamoApiItem[]>>("/api/v1/cargos/prestamos/", {
        params: { solo_activos: soloActivos },
      }),
    ),

  crearPrestamo: (body: CrearPrestamoBody) =>
    single<PrestamoApiItem>(
      apiClient.post<ApiResponse<PrestamoApiItem>>("/api/v1/cargos/prestamos/", body),
    ),

  finalizarPrestamo: (prestamoId: number) =>
    single<PrestamoApiItem>(
      apiClient.post<ApiResponse<PrestamoApiItem>>(`/api/v1/cargos/prestamos/${prestamoId}/finalizar/`, {}),
    ),

  getMotivos: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]>>("/api/v1/catalogos/tipos-movimiento/"),
    ),

  getEstatus: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]>>("/api/v1/catalogos/estatus/"),
    ),

  crearCargo: (body: CrearCargoBody) =>
    single<CargoApiItem>(
      apiClient.post<ApiResponse<CargoApiItem>>("/api/v1/cargos/crear/", body),
    ),

  getTiposNomina: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]>>("/api/v1/catalogos/tipos-nomina/"),
    ),

  getGrados: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]>>("/api/v1/catalogos/grados/"),
    ),

  getOrganismosAdscritos: () =>
    list<CatalogoApiItem>(
      apiClient.get<ApiResponse<CatalogoApiItem[]>>("/api/v1/organizacion/organismos-adscritos/"),
    ),

  getDependencias: () =>
    list<UnidadOrganizativaApiItem>(
      apiClient.get<ApiResponse<UnidadOrganizativaApiItem[]>>("/api/v1/organizacion/dependencias/"),
    ),

  getDireccionesGenerales: (dependenciaId?: number) =>
    list<UnidadOrganizativaApiItem>(
      apiClient.get<ApiResponse<UnidadOrganizativaApiItem[]>>("/api/v1/organizacion/direcciones-generales/", {
        params: { dependencia_id: dependenciaId },
      }),
    ),

  getDireccionesLinea: (direccionGeneralId?: number) =>
    list<UnidadOrganizativaApiItem>(
      apiClient.get<ApiResponse<UnidadOrganizativaApiItem[]>>("/api/v1/organizacion/direcciones-linea/", {
        params: { direccion_general_id: direccionGeneralId },
      }),
    ),

  getCoordinaciones: (direccionLineaId?: number) =>
    list<UnidadOrganizativaApiItem>(
      apiClient.get<ApiResponse<UnidadOrganizativaApiItem[]>>("/api/v1/organizacion/coordinaciones/", {
        params: { direccion_linea_id: direccionLineaId },
      }),
    ),
};
