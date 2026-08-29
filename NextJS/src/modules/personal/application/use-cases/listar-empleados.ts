/**
 * Casos de uso de Consulta de Personal (Reglas R2, R4).
 */
import type { FiltrosListadoEmpleado, RepoPersonal } from "../../domain/ports/repo-personal";
import type { EmpleadoDTO } from "../dtos/empleado-dto";
import type { Empleado } from "../../domain/entities/empleado";

function aDTO(e: Empleado): EmpleadoDTO {
  return {
    id: e.id,
    cedula: e.cedula,
    nombres: e.nombres,
    apellidos: e.apellidos,
    nombreCompleto: e.nombreCompleto,
    sexoId: e.sexoId,
    sexoNombre: e.sexoNombre,
    correo: e.correo,
    telefonoMovil: e.telefonoMovil,
    telefonoHabitacion: e.telefonoHabitacion,
    fechaNacimiento: e.fechaNacimiento,
    estadoCivilId: e.estadoCivilId,
    estadoCivilNombre: e.estadoCivilNombre,
    carnetPatria: e.carnetPatria,
    totalAnosApn: e.totalAnosApn,
  };
}

export async function listarEmpleados(
  repo: RepoPersonal,
  filtros?: FiltrosListadoEmpleado
): Promise<EmpleadoDTO[]> {
  const entidades = await repo.listarEmpleados(filtros);
  return entidades.map(aDTO);
}

export async function obtenerEmpleadoPorCedula(
  repo: RepoPersonal,
  cedula: string
): Promise<EmpleadoDTO> {
  const e = await repo.obtenerPorCedula(cedula);
  return aDTO(e);
}
