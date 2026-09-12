/**
 * Casos de uso de gestión (CRUD) de catálogos de soporte (Regla R4, R5).
 * Operan exclusivamente contra la interfaz del puerto RepoCatalogos y devuelven DTOs.
 */
import type { RepoCatalogos } from "../../domain/ports/repo-catalogos";
import type {
  CatalogoItemDTO,
  CrearAlergiaDTO,
  CrearCategoriaDTO,
  CrearDiscapacidadDTO,
  CrearPatologiaDTO,
  CrearRegionTallaDTO,
  CrearTallaDTO,
  CrearTipoPrendaDTO,
} from "../dtos/catalogos-dto";

// Alergias
export async function crearAlergia(
  repo: RepoCatalogos,
  dto: CrearAlergiaDTO,
): Promise<CatalogoItemDTO> {
  const item = await repo.crearAlergia({
    alergia: dto.alergia.trim(),
    categoria_id: dto.categoria_id,
  });
  return { id: item.id, nombre: item.nombre };
}

export async function eliminarAlergia(
  repo: RepoCatalogos,
  id: number,
): Promise<void> {
  await repo.eliminarAlergia(id);
}

export async function listarCategoriasAlergia(
  repo: RepoCatalogos,
): Promise<CatalogoItemDTO[]> {
  const items = await repo.listarCategoriasAlergia();
  return items.map((i) => ({ id: i.id, nombre: i.nombre }));
}

export async function crearCategoriaAlergia(
  repo: RepoCatalogos,
  dto: CrearCategoriaDTO,
): Promise<CatalogoItemDTO> {
  const item = await repo.crearCategoriaAlergia({
    nombre_categoria: dto.nombre_categoria.trim(),
  });
  return { id: item.id, nombre: item.nombre };
}

export async function eliminarCategoriaAlergia(
  repo: RepoCatalogos,
  id: number,
): Promise<void> {
  await repo.eliminarCategoriaAlergia(id);
}

// Patologías
export async function crearPatologia(
  repo: RepoCatalogos,
  dto: CrearPatologiaDTO,
): Promise<CatalogoItemDTO> {
  const item = await repo.crearPatologia({
    patologia: dto.patologia.trim(),
    categoria_id: dto.categoria_id,
  });
  return { id: item.id, nombre: item.nombre };
}

export async function eliminarPatologia(
  repo: RepoCatalogos,
  id: number,
): Promise<void> {
  await repo.eliminarPatologia(id);
}

export async function listarCategoriasPatologia(
  repo: RepoCatalogos,
): Promise<CatalogoItemDTO[]> {
  const items = await repo.listarCategoriasPatologia();
  return items.map((i) => ({ id: i.id, nombre: i.nombre }));
}

export async function crearCategoriaPatologia(
  repo: RepoCatalogos,
  dto: CrearCategoriaDTO,
): Promise<CatalogoItemDTO> {
  const item = await repo.crearCategoriaPatologia({
    nombre_categoria: dto.nombre_categoria.trim(),
  });
  return { id: item.id, nombre: item.nombre };
}

export async function eliminarCategoriaPatologia(
  repo: RepoCatalogos,
  id: number,
): Promise<void> {
  await repo.eliminarCategoriaPatologia(id);
}

// Discapacidades
export async function crearDiscapacidad(
  repo: RepoCatalogos,
  dto: CrearDiscapacidadDTO,
): Promise<CatalogoItemDTO> {
  const item = await repo.crearDiscapacidad({
    discapacidad: dto.discapacidad.trim(),
    categoria_id: dto.categoria_id,
  });
  return { id: item.id, nombre: item.nombre };
}

export async function eliminarDiscapacidad(
  repo: RepoCatalogos,
  id: number,
): Promise<void> {
  await repo.eliminarDiscapacidad(id);
}

export async function listarCategoriasDiscapacidad(
  repo: RepoCatalogos,
): Promise<CatalogoItemDTO[]> {
  const items = await repo.listarCategoriasDiscapacidad();
  return items.map((i) => ({ id: i.id, nombre: i.nombre }));
}

export async function crearCategoriaDiscapacidad(
  repo: RepoCatalogos,
  dto: CrearCategoriaDTO,
): Promise<CatalogoItemDTO> {
  const item = await repo.crearCategoriaDiscapacidad({
    nombre_categoria: dto.nombre_categoria.trim(),
  });
  return { id: item.id, nombre: item.nombre };
}

export async function eliminarCategoriaDiscapacidad(
  repo: RepoCatalogos,
  id: number,
): Promise<void> {
  await repo.eliminarCategoriaDiscapacidad(id);
}

// Tallas
export async function crearTalla(
  repo: RepoCatalogos,
  dto: CrearTallaDTO,
): Promise<CatalogoItemDTO> {
  const item = await repo.crearTalla({
    valor: dto.valor.trim(),
    region_id: dto.region_id,
    tipo_prenda_id: dto.tipo_prenda_id,
  });
  return { id: item.id, nombre: item.nombre };
}

export async function eliminarTalla(
  repo: RepoCatalogos,
  id: number,
): Promise<void> {
  await repo.eliminarTalla(id);
}

// Regiones de Talla
export async function crearRegionTalla(
  repo: RepoCatalogos,
  dto: CrearRegionTallaDTO,
): Promise<CatalogoItemDTO> {
  const item = await repo.crearRegionTalla({
    codigo: dto.codigo.trim(),
    descripcion: dto.descripcion?.trim() || null,
  });
  return { id: item.id, nombre: item.nombre };
}

export async function eliminarRegionTalla(
  repo: RepoCatalogos,
  id: number,
): Promise<void> {
  await repo.eliminarRegionTalla(id);
}

// Tipos de Prenda
export async function crearTipoPrenda(
  repo: RepoCatalogos,
  dto: CrearTipoPrendaDTO,
): Promise<CatalogoItemDTO> {
  const item = await repo.crearTipoPrenda({
    categoria: dto.categoria.trim(),
  });
  return { id: item.id, nombre: item.nombre };
}

export async function eliminarTipoPrenda(
  repo: RepoCatalogos,
  id: number,
): Promise<void> {
  await repo.eliminarTipoPrenda(id);
}
