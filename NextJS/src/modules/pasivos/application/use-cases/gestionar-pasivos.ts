/**
 * Casos de uso de Pasivos (Reglas R2, R4).
 */
import type { RepoPasivos } from "../../domain/ports/repo-pasivos";
import type { ProcesarEgresoInput } from "../../domain/ports/procesar-egreso";
import type { Pasivo, Pasivo as PasivoEntity } from "../../domain/entities/pasivo";
import type { ActualizarPasivoInputDTO, FiltrosPasivosDTO, PaginaPasivosDTO, PasivoDTO } from "../dtos/pasivos-dto";

function aDto(e: PasivoEntity): PasivoDTO {
  return {
    id: e.id,
    cedula: e.cedula,
    nombres: e.nombres,
    apellidos: e.apellidos,
    nombreCompleto: e.nombreCompleto,
    tipoPasivo: e.tipoPasivo,
    tipoNominaId: e.tipoNominaId,
    fechaEgreso: e.fechaEgreso,
    apnAntecedentes: e.apnAntecedentes,
    apnEnCurso: e.apnEnCurso,
    apnTotal: e.apnTotal,
    apnIncompleto: e.apnIncompleto,
    fechaIngresoApn: e.fechaIngresoApn,
    resolucion: e.resolucion,
    observaciones: e.observaciones,
    correo: e.correo,
    correoAlternativo: e.correoAlternativo,
    telefonoMovil: e.telefonoMovil,
    telefonoHabitacion: e.telefonoHabitacion,
    carnetPatria: e.carnetPatria,
    carnetPatriaSerial: e.carnetPatriaSerial,
    fechaNacimiento: e.fechaNacimiento,
    sexoNombre: e.sexoNombre,
    fechaIngresoOrganismo: e.fechaIngresoOrganismo,
    estadoCivilId: e.estadoCivilId,
    nacionalidadId: e.nacionalidadId,
    datosVivienda: e.datosVivienda,
    perfilSalud: e.perfilSalud,
    perfilFisico: e.perfilFisico,
    formacionAcademica: e.formacionAcademica,
    contactoEmergencia: e.contactoEmergencia,
    antecedentes: e.antecedentes,
    contratoActual: e.contratoActual,
    cargosHistorial: e.cargosHistorial,
  };
}

export async function listarPasivos(
  repo: RepoPasivos,
  busqueda?: string,
): Promise<PasivoDTO[]> {
  const entidades = await repo.listarPasivos(busqueda);
  return entidades.map(aDto);
}

export async function obtenerPasivoPorCedula(
  repo: RepoPasivos,
  cedula: string,
): Promise<PasivoDTO> {
  const entidad = await repo.obtenerPorCedula(cedula);
  return aDto(entidad);
}

export async function procesarEgreso(
  repo: RepoPasivos,
  input: ProcesarEgresoInput,
): Promise<PasivoDTO> {
  const entidad = await repo.procesarEgreso(input.cedula, input);
  return aDto(entidad);
}

export type { Pasivo };


export async function listarPasivosPaginados(
  repo: RepoPasivos,
  filtros: FiltrosPasivosDTO,
): Promise<PaginaPasivosDTO> {
  const pagina = await repo.listarPasivosPaginados(filtros);
  return {
    count: pagina.count,
    limit: pagina.limit,
    offset: pagina.offset,
    results: pagina.results.map(aDto),
  };
}

export async function egresarPasivo(
  repo: RepoPasivos,
  cedula: string,
  motivoId: number,
  familiarIds: number[],
): Promise<PasivoDTO> {
  return aDto(await repo.egresarPasivo(cedula, motivoId, familiarIds));
}

export async function registrarPasivo(
  repo: RepoPasivos,
  input: import("../../domain/entities/pasivo").RegistrarPasivoInput,
): Promise<PasivoDTO> {
  return aDto(await repo.registrarPasivo(input));
}

export async function listarCatalogosRegistroPasivo(repo: RepoPasivos) {
  const [sexos, estadosCiviles, nacionalidades, estados, municipios, parroquias] =
    await Promise.all([
      repo.listarSexos(),
      repo.listarEstadosCiviles(),
      repo.listarNacionalidades(),
      repo.listarEstados(),
      repo.listarMunicipios(),
      repo.listarParroquias(),
    ]);
  return { sexos, estadosCiviles, nacionalidades, estados, municipios, parroquias };
}

export async function actualizarPasivo(
  repo: RepoPasivos,
  cedula: string,
  input: ActualizarPasivoInputDTO,
): Promise<PasivoDTO> {
  return aDto(await repo.actualizarPasivo(cedula, input));
}
