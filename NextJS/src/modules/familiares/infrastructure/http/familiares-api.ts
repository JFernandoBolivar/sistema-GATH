/**
 * Cliente HTTP para Familiares conectado a las APIs canónicas /api/v1/familiares/
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

export interface CatalogoFamiliarApiItem {
  id: number;
  nombre: string;
  codigo?: string | null;
  categoria_id?: number | null;
  categoria_nombre?: string | null;
  categoria?: { id: number; nombre?: string; nombre_categoria?: string } | null;
  tipo_prenda_id?: number | null;
  tipo_prenda_nombre?: string | null;
  tipo_prenda?: { id: number; categoria?: string } | null;
  region_id?: number | null;
  region_codigo?: string | null;
  region_descripcion?: string | null;
  region?: { id: number; codigo?: string; descripcion?: string } | null;
}

export interface FormacionAcademicaFamiliarApiItem {
  nivel_academico_id?: number | null;
  carrera_id?: number | null;
  mencion_id?: number | null;
  institucion_id?: number | null;
}

export interface PerfilSaludFamiliarApiItem {
  grupo_sanguineo_id?: number | null;
  alergias?: number[];
  patologias_cronicas?: number[];
  discapacidades?: number[];
}

export interface PerfilFisicoFamiliarApiItem {
  talla_camisa_id?: number | null;
  talla_pantalon_id?: number | null;
  talla_zapatos_id?: number | null;
  talla_chaqueta_id?: number | null;
}

export interface FamiliarApiItem {
  id: number;
  empleado_cedula: string;
  cedula_familiar: string | null;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  parentesco_id: number;
  parentesco_nombre: string;
  fecha_nacimiento: string;
  sexo_id: number;
  sexo_nombre: string;
  mismo_ente: boolean;
  heredero: boolean;
  observaciones: string | null;
  formacion_academica?: FormacionAcademicaFamiliarApiItem | null;
  perfil_salud?: PerfilSaludFamiliarApiItem | null;
  perfil_fisico?: PerfilFisicoFamiliarApiItem | null;
}

export interface DocumentoFamiliarApiItem {
  id: number;
  familiar_id: number;
  tipo_documento: string;
  ruta_archivo: string;
  fecha_subida: string;
}

export interface CatalogoInlineFamiliarApiItem {
  id: number;
  nombre: string;
}

/**
 * Catálogos académicos/de salud/físicos usados por el mini-expediente del
 * familiar: son globales (no por empleado), expuestos por el mismo backend
 * que consume `modules/personal` (`/api/v1/personal/catalogos/...`). Se
 * duplican aquí (en vez de importar `modules/personal`) para respetar el
 * aislamiento Feature-Based entre módulos.
 */
const catalogosPersonalBase = "/api/v1/personal/catalogos";

async function listarCatalogo(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<CatalogoFamiliarApiItem[]> {
  const envelope = await apiClient.get<ApiResponse<CatalogoFamiliarApiItem[]>>(`${catalogosPersonalBase}/${path}/`, { params });
  return envelope.data ?? [];
}

async function listarCatalogoMaestro(path: string): Promise<CatalogoFamiliarApiItem[]> {
  const envelope = await apiClient.get<ApiResponse<CatalogoFamiliarApiItem[]>>(`/api/v1/catalogos/${path}/`);
  return envelope.data ?? [];
}

async function crearCatalogoInline(path: string, body: Record<string, unknown>): Promise<CatalogoInlineFamiliarApiItem> {
  const envelope = await apiClient.post<ApiResponse<CatalogoInlineFamiliarApiItem>>(`${catalogosPersonalBase}/${path}/`, body);
  return envelope.data;
}

export const familiaresApi = {
  getPorEmpleado: (cedula: string) =>
    apiClient.get<FamiliarApiItem[]>(`/api/v1/familiares/empleado/${cedula}/`),

  getPorId: (id: number) =>
    apiClient.get<FamiliarApiItem>(`/api/v1/familiares/${id}/`),

  crear: (cedula: string, payload: Record<string, unknown>) =>
    apiClient.post<FamiliarApiItem>(`/api/v1/familiares/empleado/${cedula}/`, payload),

  actualizar: (id: number, payload: Record<string, unknown>) =>
    apiClient.put<FamiliarApiItem>(`/api/v1/familiares/${id}/`, payload),

  eliminar: (id: number) =>
    apiClient.delete<void>(`/api/v1/familiares/${id}/`),

  getDocumentos: (familiarId: number) =>
    apiClient.get<DocumentoFamiliarApiItem[]>(`/api/v1/familiares/${familiarId}/documentos/`),

  subirDocumento: (familiarId: number, formData: FormData) =>
    apiClient.postForm<DocumentoFamiliarApiItem>(`/api/v1/familiares/${familiarId}/documentos/`, formData),

  getParentescos: () => listarCatalogoMaestro("parentescos"),

  getSexos: () => listarCatalogoMaestro("sexos"),

  // --- Catálogos del mini-expediente académico (globales, compartidos con Personal) ---
  getNivelesAcademicos: () => listarCatalogo("niveles-academicos"),

  getCarreras: (nivelAcademicoId?: number) =>
    listarCatalogo("carreras", nivelAcademicoId ? { nivel_academico_id: nivelAcademicoId } : undefined),

  getMenciones: (carreraId?: number) =>
    listarCatalogo("menciones", carreraId ? { carrera_id: carreraId } : undefined),

  getInstituciones: () => listarCatalogo("instituciones"),

  crearCarrera: (nombre: string, nivelAcademicoId: number) =>
    crearCatalogoInline("carreras", { nombre, nivel_academico_id: nivelAcademicoId }),

  crearMencion: (nombre: string, carreraId: number) =>
    crearCatalogoInline("menciones", { nombre, carrera_id: carreraId }),

  crearInstitucion: (nombre: string) => crearCatalogoInline("instituciones", { nombre }),

  // --- Catálogos del perfil de salud (globales, compartidos con Personal) ---
  getGruposSanguineos: () => listarCatalogo("grupos-sanguineos"),
  getAlergias: () => listarCatalogo("alergias"),
  getPatologias: () => listarCatalogo("patologias"),
  getDiscapacidades: () => listarCatalogo("discapacidades"),

  // --- Catálogos del perfil físico (globales, compartidos con Personal) ---
  getTiposPrenda: () => listarCatalogo("tipos-prenda"),
  getTallas: () => listarCatalogo("tallas"),
};
