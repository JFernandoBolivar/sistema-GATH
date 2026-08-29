/**
 * Puerto del Repositorio de Catálogos (Reglas R1, R4).
 */
import type {
  CatalogoItem,
  Estado,
  Municipio,
  Parroquia,
  Region,
} from "../entities/catalogos";

export interface RepoCatalogos {
  listarRegiones(): Promise<Region[]>;
  listarEstados(regionId?: number): Promise<Estado[]>;
  listarMunicipios(estadoId?: number): Promise<Municipio[]>;
  listarParroquias(municipioId?: number): Promise<Parroquia[]>;
  listarSexos(): Promise<CatalogoItem[]>;
  listarEstatus(): Promise<CatalogoItem[]>;
  listarTiposPersonal(): Promise<CatalogoItem[]>;
  listarTiposNomina(): Promise<CatalogoItem[]>;
  listarParentescos(): Promise<CatalogoItem[]>;
  listarTiposProcedencia(): Promise<CatalogoItem[]>;
  listarGrados(): Promise<CatalogoItem[]>;
  listarCategoriasMovimiento(): Promise<CatalogoItem[]>;
  listarTiposMovimiento(): Promise<CatalogoItem[]>;
  listarEstadosCiviles(): Promise<CatalogoItem[]>;
  listarPoliticas(): Promise<CatalogoItem[]>;
  listarCondicionesVivienda(): Promise<CatalogoItem[]>;
  listarCodigosPostales(): Promise<CatalogoItem[]>;
  listarGruposSanguineos(): Promise<CatalogoItem[]>;
  listarNivelesAcademicos(): Promise<CatalogoItem[]>;
  listarCarreras(): Promise<CatalogoItem[]>;
  listarMenciones(carreraId?: number): Promise<CatalogoItem[]>;
  listarInstituciones(): Promise<CatalogoItem[]>;
}
