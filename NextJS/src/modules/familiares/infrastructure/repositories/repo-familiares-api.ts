/**
 * Implementación del repositorio de Familiares usando la API REST.
 */
import type { RepoFamiliares } from "../../domain/ports/repo-familiares";
import { familiaresApi } from "../http/familiares-api";
import { documentoFamiliarApiAEntidad, familiarApiAEntidad } from "../mappers/mapper-familiares";

export const repoFamiliaresApi: RepoFamiliares = {
  async listarPorEmpleado(cedula) {
    const raw = await familiaresApi.getPorEmpleado(cedula);
    return raw.map(familiarApiAEntidad);
  },

  async obtenerPorId(id) {
    const raw = await familiaresApi.getPorId(id);
    return familiarApiAEntidad(raw);
  },

  async crearFamiliar(data) {
    const raw = await familiaresApi.crear(data.empleadoCedula, {
      cedula_familiar: data.cedulaFamiliar,
      primer_nombre: data.primerNombre,
      segundo_nombre: data.segundoNombre,
      primer_apellido: data.primerApellido,
      segundo_apellido: data.segundoApellido,
      parentesco_id: data.parentescoId,
      fecha_nacimiento: data.fechaNacimiento,
      sexo_id: data.sexoId,
      mismo_ente: data.mismoEnte,
      heredero: data.heredero,
      observaciones: data.observaciones,
    });
    return familiarApiAEntidad(raw);
  },

  async actualizarFamiliar(id, data) {
    const payload: Record<string, unknown> = {};
    if (data.primerNombre !== undefined) payload.primer_nombre = data.primerNombre;
    if (data.segundoNombre !== undefined) payload.segundo_nombre = data.segundoNombre;
    if (data.primerApellido !== undefined) payload.primer_apellido = data.primerApellido;
    if (data.segundoApellido !== undefined) payload.segundo_apellido = data.segundoApellido;
    if (data.cedulaFamiliar !== undefined) payload.cedula_familiar = data.cedulaFamiliar;
    if (data.parentescoId !== undefined) payload.parentesco_id = data.parentescoId;
    if (data.sexoId !== undefined) payload.sexo_id = data.sexoId;
    if (data.fechaNacimiento !== undefined) payload.fecha_nacimiento = data.fechaNacimiento;
    if (data.mismoEnte !== undefined) payload.mismo_ente = data.mismoEnte;
    if (data.heredero !== undefined) payload.heredero = data.heredero;
    if (data.observaciones !== undefined) payload.observaciones = data.observaciones;

    const raw = await familiaresApi.actualizar(id, payload);
    return familiarApiAEntidad(raw);
  },

  async eliminarFamiliar(id) {
    await familiaresApi.eliminar(id);
  },

  async listarDocumentos(familiarId) {
    const raw = await familiaresApi.getDocumentos(familiarId);
    return raw.map(documentoFamiliarApiAEntidad);
  },

  async listarCatalogos() {
    const [parentescos, sexos] = await Promise.all([
      familiaresApi.getParentescos(),
      familiaresApi.getSexos(),
    ]);
    return { parentescos, sexos };
  },
};
