/**
 * Implementación del repositorio de Catálogos usando la API REST.
 */
import type { RepoCatalogos } from "../../domain/ports/repo-catalogos";
import { catalogosApi } from "../http/catalogos-api";
import {
  catalogoApiAEntidad,
  estadoApiAEntidad,
  municipioApiAEntidad,
  parroquiaApiAEntidad,
  regionApiAEntidad,
} from "../mappers/mapper-catalogos";

export const repoCatalogosApi: RepoCatalogos = {
  async listarRegiones() {
    const raw = await catalogosApi.getRegiones();
    return raw.map(regionApiAEntidad);
  },

  async listarEstados(regionId?: number) {
    const raw = await catalogosApi.getEstados(regionId);
    return raw.map(estadoApiAEntidad);
  },

  async listarMunicipios(estadoId?: number) {
    const raw = await catalogosApi.getMunicipios(estadoId);
    return raw.map(municipioApiAEntidad);
  },

  async listarParroquias(municipioId?: number) {
    const raw = await catalogosApi.getParroquias(municipioId);
    return raw.map(parroquiaApiAEntidad);
  },

  async listarSexos() {
    const raw = await catalogosApi.getSexos();
    return raw.map(catalogoApiAEntidad);
  },

  async listarEstatus() {
    const raw = await catalogosApi.getEstatus();
    return raw.map(catalogoApiAEntidad);
  },

  async listarTiposPersonal() {
    const raw = await catalogosApi.getTiposPersonal();
    return raw.map(catalogoApiAEntidad);
  },

  async listarTiposNomina() {
    const raw = await catalogosApi.getTiposNomina();
    return raw.map(catalogoApiAEntidad);
  },

  async listarParentescos() {
    const raw = await catalogosApi.getParentescos();
    return raw.map(catalogoApiAEntidad);
  },

  async listarTiposProcedencia() {
    const raw = await catalogosApi.getTiposProcedencia();
    return raw.map(catalogoApiAEntidad);
  },

  async listarGrados() {
    const raw = await catalogosApi.getGrados();
    return raw.map(catalogoApiAEntidad);
  },

  async listarCategoriasMovimiento() {
    const raw = await catalogosApi.getCategoriasMovimiento();
    return raw.map(catalogoApiAEntidad);
  },

  async listarTiposMovimiento() {
    const raw = await catalogosApi.getTiposMovimiento();
    return raw.map(catalogoApiAEntidad);
  },

  async listarEstadosCiviles() {
    const raw = await catalogosApi.getEstadosCiviles();
    return raw.map(catalogoApiAEntidad);
  },

  async listarPoliticas() {
    const raw = await catalogosApi.getPoliticas();
    return raw.map(catalogoApiAEntidad);
  },

  async listarCondicionesVivienda() {
    const raw = await catalogosApi.getCondicionesVivienda();
    return raw.map(catalogoApiAEntidad);
  },

  async listarCodigosPostales() {
    const raw = await catalogosApi.getCodigosPostales();
    return raw.map(catalogoApiAEntidad);
  },

  async listarGruposSanguineos() {
    const raw = await catalogosApi.getGruposSanguineos();
    return raw.map(catalogoApiAEntidad);
  },

  async listarNivelesAcademicos() {
    const raw = await catalogosApi.getNivelesAcademicos();
    return raw.map(catalogoApiAEntidad);
  },

  async listarCarreras() {
    const raw = await catalogosApi.getCarreras();
    return raw.map(catalogoApiAEntidad);
  },

  async listarMenciones(carreraId?: number) {
    const raw = await catalogosApi.getMenciones(carreraId);
    return raw.map(catalogoApiAEntidad);
  },

  async listarInstituciones() {
    const raw = await catalogosApi.getInstituciones();
    return raw.map(catalogoApiAEntidad);
  },
};
