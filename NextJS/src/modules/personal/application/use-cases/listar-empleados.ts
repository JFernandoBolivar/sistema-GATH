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
    correoAlternativo: e.correoAlternativo ?? null,
    telefonoMovil: e.telefonoMovil,
    telefonoHabitacion: e.telefonoHabitacion,
    fechaNacimiento: e.fechaNacimiento,
    estadoCivilId: e.estadoCivilId,
    estadoCivilNombre: e.estadoCivilNombre,
    carnetPatria: e.carnetPatria,
    carnetPatriaSerial: e.carnetPatriaSerial,
    nacionalidadId: e.nacionalidadId ?? null,
    nacionalidadCodigo: e.nacionalidadCodigo ?? null,
    nacionalidadNombre: e.nacionalidadNombre ?? null,
    totalAnosApn: e.totalAnosApn,
    apnAntecedentes: e.apnAntecedentes,
    apnEnCurso: e.apnEnCurso,
    apnTotal: e.apnTotal,
    apnIncompleto: e.apnIncompleto,
    fechaIngresoApn: e.fechaIngresoApn,
    datosVivienda: e.datosVivienda,
    perfilSalud: e.perfilSalud,
    perfilFisico: e.perfilFisico,
    formacionAcademica: e.formacionAcademica,
    formacionComplementaria: e.formacionComplementaria,
    contactoEmergencia: e.contactoEmergencia,
    antecedentes: e.antecedentes,
    contratoActual: e.contratoActual,
    contratos: e.contratos,
    asignaciones: e.asignaciones,
    encargadurias: e.encargadurias,
  };
}

export interface PaginaEmpleadosDTO {
  items: EmpleadoDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listarEmpleados(
  repo: RepoPersonal,
  filtros?: FiltrosListadoEmpleado
): Promise<PaginaEmpleadosDTO> {
  const pagina = await repo.listarEmpleados(filtros);
  return {
    items: pagina.items.map(aDTO),
    total: pagina.total,
    page: pagina.page,
    pageSize: pagina.pageSize,
  };
}

export async function obtenerEmpleadoPorCedula(
  repo: RepoPersonal,
  cedula: string
): Promise<EmpleadoDTO> {
  const e = await repo.obtenerPorCedula(cedula);
  return aDTO(e);
}
