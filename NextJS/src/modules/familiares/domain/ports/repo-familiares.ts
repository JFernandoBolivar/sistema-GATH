/**
 * Puerto del Repositorio de Familiares (Reglas R1, R4).
 */
import type { DocumentoFamiliar, Familiar } from "../entities/familiar";

export interface CatalogoFamiliar {
  id: number;
  nombre: string;
  codigo?: string | null;
  categoriaId?: number | null;
  categoriaNombre?: string | null;
  tipoPrendaId?: number | null;
  tipoPrendaNombre?: string | null;
  regionId?: number | null;
  regionCodigo?: string | null;
  regionDescripcion?: string | null;
}

export interface CatalogosFamiliar {
  parentescos: CatalogoFamiliar[];
  sexos: CatalogoFamiliar[];
  nivelesAcademicos: CatalogoFamiliar[];
  carreras: CatalogoFamiliar[];
  menciones: CatalogoFamiliar[];
  instituciones: CatalogoFamiliar[];
  tiposPrenda: CatalogoFamiliar[];
  tallas: CatalogoFamiliar[];
  gruposSanguineos: CatalogoFamiliar[];
  alergias: CatalogoFamiliar[];
  patologias: CatalogoFamiliar[];
  discapacidades: CatalogoFamiliar[];
}

export interface RepoFamiliares {
  listarPorEmpleado(cedula: string): Promise<Familiar[]>;
  obtenerPorId(id: number): Promise<Familiar>;
  crearFamiliar(data: Omit<Familiar, "id" | "parentescoNombre" | "sexoNombre">): Promise<Familiar>;
  actualizarFamiliar(id: number, data: Partial<Familiar>): Promise<Familiar>;
  eliminarFamiliar(id: number): Promise<void>;
  listarDocumentos(familiarId: number): Promise<DocumentoFamiliar[]>;
  listarCatalogos(): Promise<CatalogosFamiliar>;
}
