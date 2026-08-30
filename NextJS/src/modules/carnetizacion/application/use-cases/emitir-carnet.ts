/**
 * Casos de uso de Emisión de Carnet y Consulta (Reglas R2, R4).
 *
 * `emitirCarnet` solo crea el registro (security_hash + metadatos) — no
 * genera el PDF/QR/foto físico del carnet todavía (ver Fase 2.3 del plan de
 * reparación).
 */
import type { Carnet, PlantillaCarnet } from "../../domain/entities/carnet";
import type { RepoCarnetizacion } from "../../domain/ports/repo-carnetizacion";
import type { CarnetDTO, PlantillaCarnetDTO } from "../dtos/carnet-dto";

function aCarnetDTO(e: Carnet): CarnetDTO {
  return {
    id: e.id,
    empleadoCedula: e.empleadoCedula,
    empleadoNombres: e.empleadoNombres,
    empleadoApellidos: e.empleadoApellidos,
    securityHash: e.securityHash,
    fechaEmision: e.fechaEmision,
    motivoId: e.motivoId,
    motivoNombre: e.motivoNombre,
    activo: e.activo,
    observaciones: e.observaciones,
  };
}

function aPlantillaDTO(e: PlantillaCarnet): PlantillaCarnetDTO {
  return {
    id: e.id,
    nombre: e.nombre,
    imagenUrl: e.imagenUrl,
    activo: e.activo,
    creado: e.creado,
  };
}

export async function listarCarnets(repo: RepoCarnetizacion, cedula?: string): Promise<CarnetDTO[]> {
  const entidades = await repo.listarCarnets(cedula);
  return entidades.map(aCarnetDTO);
}

export async function emitirCarnet(
  repo: RepoCarnetizacion,
  empleadoCedula: string,
  motivoId: number,
  observaciones?: string
): Promise<CarnetDTO> {
  const e = await repo.emitirCarnet(empleadoCedula, motivoId, observaciones);
  return aCarnetDTO(e);
}

export async function listarPlantillasCarnet(repo: RepoCarnetizacion): Promise<PlantillaCarnetDTO[]> {
  const entidades = await repo.listarPlantillas();
  return entidades.map(aPlantillaDTO);
}

export async function activarPlantillaCarnet(
  repo: RepoCarnetizacion,
  plantillaId: number
): Promise<PlantillaCarnetDTO> {
  const e = await repo.activarPlantilla(plantillaId);
  return aPlantillaDTO(e);
}

export async function revocarCarnet(repo: RepoCarnetizacion, carnetId: number): Promise<CarnetDTO> {
  const e = await repo.revocarCarnet(carnetId);
  return aCarnetDTO(e);
}
