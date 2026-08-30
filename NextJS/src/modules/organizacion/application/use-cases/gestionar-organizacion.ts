/**
 * Casos de uso de Gestión de Organización (Reglas R2, R4).
 *
 * Crear, actualizar y eliminar los cinco niveles de la estructura:
 * dependencia, dirección general, dirección de línea, coordinación y
 * organismo adscrito. Cada función mapea la entidad persistida a su DTO con
 * el código y el identificador de jerarquía que devuelve el backend.
 */
import type { RepoOrganizacion } from "../../domain/ports/repo-organizacion";
import type {
  Coordinacion,
  Dependencia,
  DireccionGeneral,
  DireccionLinea,
  OrganismoAdscrito,
} from "../../domain/entities/organizacion";
import type {
  CoordinacionDTO,
  DependenciaDTO,
  DireccionGeneralDTO,
  DireccionLineaDTO,
  GuardarCoordinacionInputDTO,
  GuardarDependenciaInputDTO,
  GuardarDireccionGeneralInputDTO,
  GuardarDireccionLineaInputDTO,
  GuardarOrganismoAdscritoInputDTO,
  OrganismoAdscritoDTO,
} from "../dtos/organizacion-dto";

function dependenciaADTO(e: Dependencia): DependenciaDTO {
  return { id: e.id, codigo: e.codigo, nombre: e.nombre };
}

function direccionGeneralADTO(e: DireccionGeneral): DireccionGeneralDTO {
  return { id: e.id, codigo: e.codigo, nombre: e.nombre, dependenciaId: e.dependenciaId };
}

function direccionLineaADTO(e: DireccionLinea): DireccionLineaDTO {
  return { id: e.id, codigo: e.codigo, nombre: e.nombre, direccionGeneralId: e.direccionGeneralId };
}

function coordinacionADTO(e: Coordinacion): CoordinacionDTO {
  return { id: e.id, codigo: e.codigo, nombre: e.nombre, direccionLineaId: e.direccionLineaId };
}

function organismoADTO(e: OrganismoAdscrito): OrganismoAdscritoDTO {
  return { id: e.id, nombre: e.nombre, parentId: e.parentId };
}

export async function crearDependencia(
  repo: RepoOrganizacion,
  input: GuardarDependenciaInputDTO,
): Promise<DependenciaDTO> {
  return dependenciaADTO(await repo.crearDependencia(input));
}

export async function actualizarDependencia(
  repo: RepoOrganizacion,
  id: number,
  input: GuardarDependenciaInputDTO,
): Promise<DependenciaDTO> {
  return dependenciaADTO(await repo.actualizarDependencia(id, input));
}

export async function eliminarDependencia(repo: RepoOrganizacion, id: number): Promise<void> {
  await repo.eliminarDependencia(id);
}

export async function crearDireccionGeneral(
  repo: RepoOrganizacion,
  input: GuardarDireccionGeneralInputDTO,
): Promise<DireccionGeneralDTO> {
  return direccionGeneralADTO(await repo.crearDireccionGeneral(input));
}

export async function actualizarDireccionGeneral(
  repo: RepoOrganizacion,
  id: number,
  input: GuardarDireccionGeneralInputDTO,
): Promise<DireccionGeneralDTO> {
  return direccionGeneralADTO(await repo.actualizarDireccionGeneral(id, input));
}

export async function eliminarDireccionGeneral(repo: RepoOrganizacion, id: number): Promise<void> {
  await repo.eliminarDireccionGeneral(id);
}

export async function crearDireccionLinea(
  repo: RepoOrganizacion,
  input: GuardarDireccionLineaInputDTO,
): Promise<DireccionLineaDTO> {
  return direccionLineaADTO(await repo.crearDireccionLinea(input));
}

export async function actualizarDireccionLinea(
  repo: RepoOrganizacion,
  id: number,
  input: GuardarDireccionLineaInputDTO,
): Promise<DireccionLineaDTO> {
  return direccionLineaADTO(await repo.actualizarDireccionLinea(id, input));
}

export async function eliminarDireccionLinea(repo: RepoOrganizacion, id: number): Promise<void> {
  await repo.eliminarDireccionLinea(id);
}

export async function crearCoordinacion(
  repo: RepoOrganizacion,
  input: GuardarCoordinacionInputDTO,
): Promise<CoordinacionDTO> {
  return coordinacionADTO(await repo.crearCoordinacion(input));
}

export async function actualizarCoordinacion(
  repo: RepoOrganizacion,
  id: number,
  input: GuardarCoordinacionInputDTO,
): Promise<CoordinacionDTO> {
  return coordinacionADTO(await repo.actualizarCoordinacion(id, input));
}

export async function eliminarCoordinacion(repo: RepoOrganizacion, id: number): Promise<void> {
  await repo.eliminarCoordinacion(id);
}

export async function crearOrganismoAdscrito(
  repo: RepoOrganizacion,
  input: GuardarOrganismoAdscritoInputDTO,
): Promise<OrganismoAdscritoDTO> {
  return organismoADTO(await repo.crearOrganismoAdscrito(input));
}

export async function actualizarOrganismoAdscrito(
  repo: RepoOrganizacion,
  id: number,
  input: GuardarOrganismoAdscritoInputDTO,
): Promise<OrganismoAdscritoDTO> {
  return organismoADTO(await repo.actualizarOrganismoAdscrito(id, input));
}

export async function eliminarOrganismoAdscrito(
  repo: RepoOrganizacion,
  id: number,
): Promise<void> {
  await repo.eliminarOrganismoAdscrito(id);
}
