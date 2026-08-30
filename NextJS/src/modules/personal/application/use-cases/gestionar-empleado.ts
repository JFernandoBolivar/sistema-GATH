/**
 * Casos de uso de Registro y Edición de Empleado (Reglas R2, R4).
 */
import type { RepoPersonal } from "../../domain/ports/repo-personal";
import type { EmpleadoDTO, GuardarEmpleadoInputDTO } from "../dtos/empleado-dto";

function aDTO(e: Awaited<ReturnType<RepoPersonal["crearEmpleado"]>>): EmpleadoDTO {
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
    datosVivienda: e.datosVivienda,
    perfilSalud: e.perfilSalud,
    perfilFisico: e.perfilFisico,
    formacionAcademica: e.formacionAcademica,
    formacionComplementaria: e.formacionComplementaria,
    contactoEmergencia: e.contactoEmergencia,
    antecedentes: e.antecedentes,
    contratoActual: e.contratoActual,
  };
}

export async function registrarEmpleado(
  repo: RepoPersonal,
  input: GuardarEmpleadoInputDTO,
): Promise<EmpleadoDTO> {
  const e = await repo.crearEmpleado({
    cedula: input.cedula,
    nombres: input.nombres,
    apellidos: input.apellidos,
    sexoId: input.sexoId,
    fechaNacimiento: input.fechaNacimiento,
    correo: input.correo ?? null,
    telefonoMovil: input.telefonoMovil ?? null,
    telefonoHabitacion: input.telefonoHabitacion ?? null,
    estadoCivilId: input.estadoCivilId ?? null,
    carnetPatria: input.carnetPatria ?? null,
    datosVivienda: input.datosVivienda ?? null,
    perfilSalud: input.perfilSalud ?? null,
    perfilFisico: input.perfilFisico ?? null,
    formacionAcademica: input.formacionAcademica ?? [],
    formacionComplementaria: input.formacionComplementaria ?? [],
    contactoEmergencia: input.contactoEmergencia ?? [],
    antecedentes: input.antecedentes ?? [],
    contrato: input.contrato ?? [],
  });
  return aDTO(e);
}

export async function actualizarEmpleado(
  repo: RepoPersonal,
  cedula: string,
  data: Partial<GuardarEmpleadoInputDTO>,
): Promise<EmpleadoDTO> {
  const e = await repo.actualizarEmpleado(cedula, {
    cedula: data.cedula,
    nombres: data.nombres,
    apellidos: data.apellidos,
    sexoId: data.sexoId,
    fechaNacimiento: data.fechaNacimiento,
    correo: data.correo,
    telefonoMovil: data.telefonoMovil,
    telefonoHabitacion: data.telefonoHabitacion,
    estadoCivilId: data.estadoCivilId,
    carnetPatria: data.carnetPatria,
    datosVivienda: data.datosVivienda,
    perfilSalud: data.perfilSalud,
    perfilFisico: data.perfilFisico,
    formacionAcademica: data.formacionAcademica,
    formacionComplementaria: data.formacionComplementaria,
    contactoEmergencia: data.contactoEmergencia,
    antecedentes: data.antecedentes,
    contrato: data.contrato,
  });
  return aDTO(e);
}
