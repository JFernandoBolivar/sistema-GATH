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
  listarTiposPrenda(): Promise<CatalogoItem[]>;
  listarRegionesTalla(): Promise<CatalogoItem[]>;
  listarTallas(tipoPrendaId?: number): Promise<CatalogoItem[]>;
  listarCapacitaciones(): Promise<CatalogoItem[]>;
  listarGruposCapacitacion(): Promise<CatalogoItem[]>;
  listarAlergias(): Promise<CatalogoItem[]>;
  listarPatologias(): Promise<CatalogoItem[]>;
  listarDiscapacidades(): Promise<CatalogoItem[]>;

  // Métodos de escritura / CRUD para catálogos de soporte
  crearAlergia(datos: { alergia: string; categoria_id: number }): Promise<CatalogoItem>;
  eliminarAlergia(id: number): Promise<void>;
  listarCategoriasAlergia(): Promise<CatalogoItem[]>;
  crearCategoriaAlergia(datos: { nombre_categoria: string }): Promise<CatalogoItem>;
  eliminarCategoriaAlergia(id: number): Promise<void>;

  crearPatologia(datos: { patologia: string; categoria_id: number }): Promise<CatalogoItem>;
  eliminarPatologia(id: number): Promise<void>;
  listarCategoriasPatologia(): Promise<CatalogoItem[]>;
  crearCategoriaPatologia(datos: { nombre_categoria: string }): Promise<CatalogoItem>;
  eliminarCategoriaPatologia(id: number): Promise<void>;

  crearDiscapacidad(datos: { discapacidad: string; categoria_id: number }): Promise<CatalogoItem>;
  eliminarDiscapacidad(id: number): Promise<void>;
  listarCategoriasDiscapacidad(): Promise<CatalogoItem[]>;
  crearCategoriaDiscapacidad(datos: { nombre_categoria: string }): Promise<CatalogoItem>;
  eliminarCategoriaDiscapacidad(id: number): Promise<void>;

  crearTalla(datos: { valor: string; region_id: number; tipo_prenda_id: number }): Promise<CatalogoItem>;
  eliminarTalla(id: number): Promise<void>;

  crearRegionTalla(datos: { codigo: string; descripcion?: string | null }): Promise<CatalogoItem>;
  eliminarRegionTalla(id: number): Promise<void>;

  crearTipoPrenda(datos: { categoria: string }): Promise<CatalogoItem>;
  eliminarTipoPrenda(id: number): Promise<void>;

  listarOrganismosAdscritos(): Promise<CatalogoItem[]>;
  crearOrganismoAdscrito(datos: { nombre: string; parent_id?: number | null }): Promise<CatalogoItem>;
  actualizarOrganismoAdscrito(id: number, datos: { nombre: string; parent_id?: number | null }): Promise<CatalogoItem>;
  eliminarOrganismoAdscrito(id: number): Promise<void>;
}

