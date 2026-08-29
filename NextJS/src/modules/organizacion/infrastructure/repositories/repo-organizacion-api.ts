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

  async listarDireccionesGenerales(dependenciaId?: number) {
    const raw = await organizacionApi.getDireccionesGenerales(dependenciaId);
    return raw.map(direccionGeneralApiAEntidad);
  },

  async listarDireccionesLinea(direccionGeneralId?: number) {
    const raw = await organizacionApi.getDireccionesLinea(direccionGeneralId);
    return raw.map(direccionLineaApiAEntidad);
  },

  async listarCoordinaciones(direccionLineaId?: number) {
    const raw = await organizacionApi.getCoordinaciones(direccionLineaId);
    return raw.map(coordinacionApiAEntidad);
  },

  async listarOrganismosAdscritos() {
    const raw = await organizacionApi.getOrganismosAdscritos();
    return raw.map(organismoAdscritoApiAEntidad);
  },
};
