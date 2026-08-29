/**
 * Casos de uso de Organización (Reglas R2, R4).
 */
import type { RepoOrganizacion } from "../../domain/ports/repo-organizacion";
import type {
  CoordinacionDTO,
  DependenciaDTO,
  DireccionGeneralDTO,
  DireccionLineaDTO,
  OrganismoAdscritoDTO,
} from "../dtos/organizacion-dto";

export async function listarDependencias(
  repo: RepoOrganizacion
): Promise<DependenciaDTO[]> {
  const entidades = await repo.listarDependencias();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}

export async function listarDireccionesGenerales(
  repo: RepoOrganizacion,
  dependenciaId?: number
): Promise<DireccionGeneralDTO[]> {
  const entidades = await repo.listarDireccionesGenerales(dependenciaId);
  return entidades.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    dependenciaId: e.dependenciaId,
  }));
}

export async function listarDireccionesLinea(
  repo: RepoOrganizacion,
  direccionGeneralId?: number
): Promise<DireccionLineaDTO[]> {
  const entidades = await repo.listarDireccionesLinea(direccionGeneralId);
  return entidades.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    direccionGeneralId: e.direccionGeneralId,
  }));
}

export async function listarCoordinaciones(
  repo: RepoOrganizacion,
  direccionLineaId?: number
): Promise<CoordinacionDTO[]> {
  const entidades = await repo.listarCoordinaciones(direccionLineaId);
  return entidades.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    direccionLineaId: e.direccionLineaId,
  }));
}

export async function listarOrganismosAdscritos(
  repo: RepoOrganizacion
): Promise<OrganismoAdscritoDTO[]> {
  const entidades = await repo.listarOrganismosAdscritos();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}
