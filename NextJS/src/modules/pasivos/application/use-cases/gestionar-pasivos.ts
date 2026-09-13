/**
 * Casos de uso de Pasivos (Reglas R2, R4).
 */
import type { RepoPasivos } from "../../domain/ports/repo-pasivos";
import type { ProcesarEgresoInput } from "../../domain/ports/procesar-egreso";
import type { Pasivo, Pasivo as PasivoEntity } from "../../domain/entities/pasivo";
import type { PasivoDTO } from "../dtos/pasivos-dto";

function aDto(e: PasivoEntity): PasivoDTO {
  return {
    id: e.id,
    cedula: e.cedula,
    nombres: e.nombres,
    apellidos: e.apellidos,
    nombreCompleto: e.nombreCompleto,
    tipoPasivo: e.tipoPasivo,
    fechaEgreso: e.fechaEgreso,
    resolucion: e.resolucion,
    observaciones: e.observaciones,
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
