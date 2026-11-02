/**
 * Implementación del repositorio de Organización usando la API REST.
 */
import type { RepoOrganizacion } from "../../domain/ports/repo-organizacion";
import { organizacionApi } from "../http/organizacion-api";
import {
  coordinacionApiAEntidad,
  dependenciaApiAEntidad,
  direccionGeneralApiAEntidad,
  direccionLineaApiAEntidad,
  organismoAdscritoApiAEntidad,
} from "../mappers/mapper-organizacion";

export const repoOrganizacionApi: RepoOrganizacion = {
  async listarDependencias() {
    const raw = await organizacionApi.getDependencias();
    return raw.map(dependenciaApiAEntidad);
  },

  async crearDependencia(data) {
    return dependenciaApiAEntidad(
      await organizacionApi.crearDependencia({ codigo: data.codigo, nombre: data.nombre }),
    );
  },

  async actualizarDependencia(id, data) {
    return dependenciaApiAEntidad(
      await organizacionApi.actualizarDependencia(id, { codigo: data.codigo, nombre: data.nombre }),
    );
  },

  async eliminarDependencia(id) {
    await organizacionApi.eliminarDependencia(id);
  },

  async listarDireccionesGenerales(dependenciaId?) {
    const raw = await organizacionApi.getDireccionesGenerales(dependenciaId);
    return raw.map(direccionGeneralApiAEntidad);
  },

  async crearDireccionGeneral(data) {
    return direccionGeneralApiAEntidad(
      await organizacionApi.crearDireccionGeneral({
        codigo: data.codigo,
        nombre: data.nombre,
        dependencia_id: data.dependenciaId,
      }),
    );
  },

  async actualizarDireccionGeneral(id, data) {
    return direccionGeneralApiAEntidad(
      await organizacionApi.actualizarDireccionGeneral(id, {
        codigo: data.codigo,
        nombre: data.nombre,
        dependencia_id: data.dependenciaId,
      }),
    );
  },

  async eliminarDireccionGeneral(id) {
    await organizacionApi.eliminarDireccionGeneral(id);
  },

  async listarDireccionesLinea(direccionGeneralId?) {
    const raw = await organizacionApi.getDireccionesLinea(direccionGeneralId);
    return raw.map(direccionLineaApiAEntidad);
  },

  async crearDireccionLinea(data) {
    return direccionLineaApiAEntidad(
      await organizacionApi.crearDireccionLinea({
        codigo: data.codigo,
        nombre: data.nombre,
        direccion_general_id: data.direccionGeneralId,
      }),
    );
  },

  async actualizarDireccionLinea(id, data) {
    return direccionLineaApiAEntidad(
      await organizacionApi.actualizarDireccionLinea(id, {
        codigo: data.codigo,
        nombre: data.nombre,
        direccion_general_id: data.direccionGeneralId,
      }),
    );
  },

  async eliminarDireccionLinea(id) {
    await organizacionApi.eliminarDireccionLinea(id);
  },

  async listarCoordinaciones(direccionLineaId?) {
    const raw = await organizacionApi.getCoordinaciones(direccionLineaId);
    return raw.map(coordinacionApiAEntidad);
  },

  async crearCoordinacion(data) {
    return coordinacionApiAEntidad(
      await organizacionApi.crearCoordinacion({
        codigo: data.codigo,
        nombre: data.nombre,
        direccion_linea_id: data.direccionLineaId,
      }),
    );
  },

  async actualizarCoordinacion(id, data) {
    return coordinacionApiAEntidad(
      await organizacionApi.actualizarCoordinacion(id, {
        codigo: data.codigo,
        nombre: data.nombre,
        direccion_linea_id: data.direccionLineaId,
      }),
    );
  },

  async eliminarCoordinacion(id) {
    await organizacionApi.eliminarCoordinacion(id);
  },

  async listarOrganismosAdscritos() {
    const raw = await organizacionApi.getOrganismosAdscritos();
    return raw.map(organismoAdscritoApiAEntidad);
  },

  async crearOrganismoAdscrito(data) {
    return organismoAdscritoApiAEntidad(
      await organizacionApi.crearOrganismoAdscrito({ nombre: data.nombre, parent_id: data.parentId }),
    );
  },

  async actualizarOrganismoAdscrito(id, data) {
    return organismoAdscritoApiAEntidad(
      await organizacionApi.actualizarOrganismoAdscrito(id, { nombre: data.nombre, parent_id: data.parentId }),
    );
  },

  async eliminarOrganismoAdscrito(id) {
    await organizacionApi.eliminarOrganismoAdscrito(id);
  },
};
