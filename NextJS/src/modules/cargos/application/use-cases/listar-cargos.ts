/**
 * Casos de uso de Consulta de Cargos (Reglas R2, R4).
 */
import type { RepoCargos } from "../../domain/ports/repo-cargos";
import type {
  CargoAsignacionDTO,
  DenominacionCargoDTO,
  CatalogoCargoItemDTO,
  UnidadOrganizativaCargoDTO,
} from "../dtos/cargo-dto";
import type {
  CargoAsignacion,
  DenominacionCargo,
  CatalogoCargoItem,
  UnidadOrganizativaCargo,
} from "../../domain/entities/cargo";

function cargoADto(e: CargoAsignacion): CargoAsignacionDTO {
  return {
    id: e.id,
    codigo: e.codigo,
    empleadoCedula: e.empleadoCedula,
    denominacionId: e.denominacionId,
    denominacionNombre: e.denominacionNombre,
    especificaId: e.especificaId,
    especificaNombre: e.especificaNombre,
    tipoNominaId: e.tipoNominaId,
    tipoNominaNombre: e.tipoNominaNombre,
    estatusId: e.estatusId,
    estatusNombre: e.estatusNombre,
    dependenciaId: e.dependenciaId,
    dependenciaNombre: e.dependenciaNombre,
    direccionGeneralId: e.direccionGeneralId,
    direccionGeneralNombre: e.direccionGeneralNombre,
    direccionLineaId: e.direccionLineaId,
    direccionLineaNombre: e.direccionLineaNombre,
    coordinacionId: e.coordinacionId,
    coordinacionNombre: e.coordinacionNombre,
    organismoId: e.organismoId,
    organismoNombre: e.organismoNombre,
    gradoId: e.gradoId,
    gradoNombre: e.gradoNombre,
    observaciones: e.observaciones,
    estaVacante: e.estaVacante,
  };
}

function denominacionADto(e: DenominacionCargo): DenominacionCargoDTO {
  return { id: e.id, nombre: e.nombre, orden: e.orden };
}

function catalogoADto(e: CatalogoCargoItem): CatalogoCargoItemDTO {
  return { id: e.id, nombre: e.nombre };
}

function unidadOrganizativaADto(e: UnidadOrganizativaCargo): UnidadOrganizativaCargoDTO {
  return { id: e.id, codigo: e.codigo, nombre: e.nombre };
}

export async function listarCargos(
  repo: RepoCargos,
  filtros?: {
    dependenciaId?: number;
    tipoNominaId?: number;
    direccionGeneralId?: number;
    direccionLineaId?: number;
    coordinacionId?: number;
    codigo?: string;
    soloVacantes?: boolean;
  }
): Promise<CargoAsignacionDTO[]> {
  const entidades = await repo.listarCargos(filtros);
  return entidades.map(cargoADto);
}

export async function listarDenominaciones(
  repo: RepoCargos
): Promise<DenominacionCargoDTO[]> {
  const entidades = await repo.listarDenominaciones();
  return entidades.map(denominacionADto);
}

export async function listarDenominacionesEspecificas(
  repo: RepoCargos
): Promise<DenominacionCargoDTO[]> {
  const entidades = await repo.listarDenominacionesEspecificas();
  return entidades.map(denominacionADto);
}

export async function listarMotivos(repo: RepoCargos, categoria?: string): Promise<CatalogoCargoItemDTO[]> {
  const entidades = await repo.listarMotivos(categoria);
  return entidades.map(catalogoADto);
}

export async function listarEstatusCargo(repo: RepoCargos): Promise<CatalogoCargoItemDTO[]> {
  const entidades = await repo.listarEstatus();
  return entidades.map(catalogoADto);
}

export async function listarTiposNomina(repo: RepoCargos): Promise<CatalogoCargoItemDTO[]> {
  const entidades = await repo.listarTiposNomina();
  return entidades.map(catalogoADto);
}

export async function listarGrados(repo: RepoCargos): Promise<CatalogoCargoItemDTO[]> {
  const entidades = await repo.listarGrados();
  return entidades.map(catalogoADto);
}

export async function listarOrganismosAdscritos(repo: RepoCargos): Promise<CatalogoCargoItemDTO[]> {
  const entidades = await repo.listarOrganismosAdscritos();
  return entidades.map(catalogoADto);
}

export async function listarDependencias(repo: RepoCargos): Promise<UnidadOrganizativaCargoDTO[]> {
  const entidades = await repo.listarDependencias();
  return entidades.map(unidadOrganizativaADto);
}

export async function listarDireccionesGenerales(
  repo: RepoCargos,
  dependenciaId?: number,
): Promise<UnidadOrganizativaCargoDTO[]> {
  const entidades = await repo.listarDireccionesGenerales(dependenciaId);
  return entidades.map(unidadOrganizativaADto);
}

export async function listarDireccionesLinea(
  repo: RepoCargos,
  direccionGeneralId?: number,
): Promise<UnidadOrganizativaCargoDTO[]> {
  const entidades = await repo.listarDireccionesLinea(direccionGeneralId);
  return entidades.map(unidadOrganizativaADto);
}

export async function listarCoordinaciones(
  repo: RepoCargos,
  direccionLineaId?: number,
): Promise<UnidadOrganizativaCargoDTO[]> {
  const entidades = await repo.listarCoordinaciones(direccionLineaId);
  return entidades.map(unidadOrganizativaADto);
}
