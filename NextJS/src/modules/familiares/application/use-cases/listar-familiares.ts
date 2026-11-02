/**
 * Casos de uso de Consulta de Familiares (Reglas R2, R4).
 */
import type { RepoFamiliares } from "../../domain/ports/repo-familiares";
import type { DocumentoFamiliarDTO, FamiliarDTO } from "../dtos/familiar-dto";

export async function listarFamiliaresPorEmpleado(
  repo: RepoFamiliares,
  cedula: string
): Promise<FamiliarDTO[]> {
  const entidades = await repo.listarPorEmpleado(cedula);
  return entidades.map((e) => ({
    id: e.id,
    empleadoCedula: e.empleadoCedula,
    cedulaFamiliar: e.cedulaFamiliar,
    primerNombre: e.primerNombre,
    segundoNombre: e.segundoNombre,
    primerApellido: e.primerApellido,
    segundoApellido: e.segundoApellido,
    parentescoId: e.parentescoId,
    parentescoNombre: e.parentescoNombre,
    fechaNacimiento: e.fechaNacimiento,
    sexoId: e.sexoId,
    sexoNombre: e.sexoNombre,
    mismoEnte: e.mismoEnte,
    heredero: e.heredero,
    observaciones: e.observaciones,
    formacionAcademica: e.formacionAcademica ?? null,
    perfilSalud: e.perfilSalud ?? null,
    perfilFisico: e.perfilFisico ?? null,
  }));
}

export async function listarDocumentosFamiliar(
  repo: RepoFamiliares,
  familiarId: number
): Promise<DocumentoFamiliarDTO[]> {
  const entidades = await repo.listarDocumentos(familiarId);
  return entidades.map((e) => ({
    id: e.id,
    familiarId: e.familiarId,
    tipoDocumento: e.tipoDocumento,
    rutaArchivo: e.rutaArchivo,
    fechaSubida: e.fechaSubida,
  }));
}

export async function subirDocumentoFamiliar(
  repo: RepoFamiliares,
  familiarId: number,
  tipoDocumento: Parameters<RepoFamiliares["subirDocumento"]>[1],
  archivo: File,
): Promise<DocumentoFamiliarDTO> {
  const e = await repo.subirDocumento(familiarId, tipoDocumento, archivo);
  return {
    id: e.id,
    familiarId: e.familiarId,
    tipoDocumento: e.tipoDocumento,
    rutaArchivo: e.rutaArchivo,
    fechaSubida: e.fechaSubida,
  };
}
