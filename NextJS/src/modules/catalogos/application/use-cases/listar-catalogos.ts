/**
 * Casos de uso de Catálogos (Reglas R2, R4).
 */
import type { RepoCatalogos } from "../../domain/ports/repo-catalogos";
import type {
  CatalogoItemDTO,
  EstadoDTO,
  MunicipioDTO,
  ParroquiaDTO,
  RegionDTO,
} from "../dtos/catalogos-dto";

export async function listarRegiones(repo: RepoCatalogos): Promise<RegionDTO[]> {
  const entidades = await repo.listarRegiones();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarEstados(
  repo: RepoCatalogos,
  regionId?: number
): Promise<EstadoDTO[]> {
  const entidades = await repo.listarEstados(regionId);
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre, regionId: e.regionId }));
}

export async function listarMunicipios(
  repo: RepoCatalogos,
  estadoId?: number
): Promise<MunicipioDTO[]> {
  const entidades = await repo.listarMunicipios(estadoId);
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre, estadoId: e.estadoId }));
}

export async function listarParroquias(
  repo: RepoCatalogos,
  municipioId?: number
): Promise<ParroquiaDTO[]> {
  const entidades = await repo.listarParroquias(municipioId);
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre, municipioId: e.municipioId }));
}

export async function listarSexos(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarSexos();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarEstatus(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarEstatus();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarTiposPersonal(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarTiposPersonal();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarTiposNomina(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarTiposNomina();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarParentescos(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarParentescos();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarTiposProcedencia(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarTiposProcedencia();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarGrados(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarGrados();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarCategoriasMovimiento(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarCategoriasMovimiento();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarTiposMovimiento(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarTiposMovimiento();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarEstadosCiviles(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarEstadosCiviles();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarPoliticas(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarPoliticas();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarCondicionesVivienda(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarCondicionesVivienda();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarCodigosPostales(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarCodigosPostales();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarGruposSanguineos(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarGruposSanguineos();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarNivelesAcademicos(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarNivelesAcademicos();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarCarreras(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarCarreras();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarMenciones(repo: RepoCatalogos, carreraId?: number): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarMenciones(carreraId);
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarInstituciones(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarInstituciones();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarTiposPrenda(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarTiposPrenda();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarRegionesTalla(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarRegionesTalla();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarTallas(repo: RepoCatalogos, tipoPrendaId?: number): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarTallas(tipoPrendaId);
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarCapacitaciones(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarCapacitaciones();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarGruposCapacitacion(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarGruposCapacitacion();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarAlergias(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarAlergias();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarPatologias(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarPatologias();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarDiscapacidades(repo: RepoCatalogos): Promise<CatalogoItemDTO[]> {
  const entidades = await repo.listarDiscapacidades();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}
