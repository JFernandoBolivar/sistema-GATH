/**
 * Implementación del repositorio de Personal usando la API REST.
 */
import type { RepoPersonal } from "../../domain/ports/repo-personal";
import { personalApi } from "../http/personal-api";
import { empleadoApiAEntidad } from "../mappers/mapper-personal";

export const repoPersonalApi: RepoPersonal = {
  async listarEmpleados(filtros) {
    const raw = await personalApi.getEmpleados({ q: filtros?.busqueda });
    return raw.map(empleadoApiAEntidad);
  },

  async obtenerPorCedula(cedula) {
    const raw = await personalApi.getPorCedula(cedula);
    return empleadoApiAEntidad(raw);
  },

  async crearEmpleado(data) {
    const raw = await personalApi.crear({
      cedula: data.cedula,
      nombres: data.nombres,
      apellidos: data.apellidos,
      sexo_id: data.sexoId,
      fecha_nacimiento: data.fechaNacimiento,
      correo: data.correo,
      telefono_movil: data.telefonoMovil,
      telefono_habitacion: data.telefonoHabitacion,
      estado_civil_id: data.estadoCivilId,
      carnet_patria: data.carnetPatria,
    });
    return empleadoApiAEntidad(raw);
  },

  async actualizarEmpleado(cedula, data) {
    const payload: Record<string, unknown> = {};
    if (data.nombres !== undefined) payload.nombres = data.nombres;
    if (data.apellidos !== undefined) payload.apellidos = data.apellidos;
    if (data.sexoId !== undefined) payload.sexo_id = data.sexoId;
    if (data.fechaNacimiento !== undefined) payload.fecha_nacimiento = data.fechaNacimiento;
    if (data.correo !== undefined) payload.correo = data.correo;
    if (data.telefonoMovil !== undefined) payload.telefono_movil = data.telefonoMovil;
    if (data.telefonoHabitacion !== undefined) payload.telefono_habitacion = data.telefonoHabitacion;
    if (data.estadoCivilId !== undefined) payload.estado_civil_id = data.estadoCivilId;
    if (data.carnetPatria !== undefined) payload.carnet_patria = data.carnetPatria;

    const raw = await personalApi.actualizar(cedula, payload);
    return empleadoApiAEntidad(raw);
  },
};
