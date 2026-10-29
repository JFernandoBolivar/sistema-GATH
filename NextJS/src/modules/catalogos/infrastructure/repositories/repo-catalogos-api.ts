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

  async listarTiposPrenda() {
    const raw = await catalogosApi.getTiposPrenda();
    return raw.map(catalogoApiAEntidad);
  },

  async listarRegionesTalla() {
    const raw = await catalogosApi.getRegionesTalla();
    return raw.map(catalogoApiAEntidad);
  },

  async listarTallas(tipoPrendaId?: number) {
    const raw = await catalogosApi.getTallas(tipoPrendaId);
    return raw.map(catalogoApiAEntidad);
  },

  async listarCapacitaciones() {
    const raw = await catalogosApi.getCapacitaciones();
    return raw.map(catalogoApiAEntidad);
  },

  async listarGruposCapacitacion() {
    const raw = await catalogosApi.getGruposCapacitacion();
    return raw.map(catalogoApiAEntidad);
  },

  async listarAlergias() {
    const raw = await catalogosApi.getAlergias();
    return raw.map(catalogoApiAEntidad);
  },

  async listarPatologias() {
    const raw = await catalogosApi.getPatologias();
    return raw.map(catalogoApiAEntidad);
  },

  async listarDiscapacidades() {
    const raw = await catalogosApi.getDiscapacidades();
    return raw.map(catalogoApiAEntidad);
  },

  // Escritura / CRUD
  async crearAlergia(datos) {
    const raw = await catalogosApi.crearAlergia(datos);
    return catalogoApiAEntidad(raw);
  },
  async eliminarAlergia(id) {
    await catalogosApi.eliminarAlergia(id);
  },
  async listarCategoriasAlergia() {
    const raw = await catalogosApi.getCategoriasAlergia();
    return raw.map(catalogoApiAEntidad);
  },
  async crearCategoriaAlergia(datos) {
    const raw = await catalogosApi.crearCategoriaAlergia(datos);
    return catalogoApiAEntidad(raw);
  },
  async eliminarCategoriaAlergia(id) {
    await catalogosApi.eliminarCategoriaAlergia(id);
  },

  async crearPatologia(datos) {
    const raw = await catalogosApi.crearPatologia(datos);
    return catalogoApiAEntidad(raw);
  },
  async eliminarPatologia(id) {
    await catalogosApi.eliminarPatologia(id);
  },
  async listarCategoriasPatologia() {
    const raw = await catalogosApi.getCategoriasPatologia();
    return raw.map(catalogoApiAEntidad);
  },
  async crearCategoriaPatologia(datos) {
    const raw = await catalogosApi.crearCategoriaPatologia(datos);
    return catalogoApiAEntidad(raw);
  },
  async eliminarCategoriaPatologia(id) {
    await catalogosApi.eliminarCategoriaPatologia(id);
  },

  async crearDiscapacidad(datos) {
    const raw = await catalogosApi.crearDiscapacidad(datos);
    return catalogoApiAEntidad(raw);
  },
  async eliminarDiscapacidad(id) {
    await catalogosApi.eliminarDiscapacidad(id);
  },
  async listarCategoriasDiscapacidad() {
    const raw = await catalogosApi.getCategoriasDiscapacidad();
    return raw.map(catalogoApiAEntidad);
  },
  async crearCategoriaDiscapacidad(datos) {
    const raw = await catalogosApi.crearCategoriaDiscapacidad(datos);
    return catalogoApiAEntidad(raw);
  },
  async eliminarCategoriaDiscapacidad(id) {
    await catalogosApi.eliminarCategoriaDiscapacidad(id);
  },

  async crearTalla(datos) {
    const raw = await catalogosApi.crearTalla(datos);
    return catalogoApiAEntidad(raw);
  },
  async eliminarTalla(id) {
    await catalogosApi.eliminarTalla(id);
  },

  async crearRegionTalla(datos) {
    const raw = await catalogosApi.crearRegionTalla(datos);
    return catalogoApiAEntidad(raw);
  },
  async eliminarRegionTalla(id) {
    await catalogosApi.eliminarRegionTalla(id);
  },

  async crearTipoPrenda(datos) {
    const raw = await catalogosApi.crearTipoPrenda(datos);
    return catalogoApiAEntidad(raw);
  },
  async eliminarTipoPrenda(id) {
    await catalogosApi.eliminarTipoPrenda(id);
  },

  async listarOrganismosAdscritos() {
    const raw = await catalogosApi.getOrganismosAdscritos();
    return raw.map(catalogoApiAEntidad);
  },
  async crearOrganismoAdscrito(datos) {
    const raw = await catalogosApi.crearOrganismoAdscrito(datos);
    return catalogoApiAEntidad(raw);
  },
  async actualizarOrganismoAdscrito(id, datos) {
    const raw = await catalogosApi.actualizarOrganismoAdscrito(id, datos);
    return catalogoApiAEntidad(raw);
  },
  async eliminarOrganismoAdscrito(id) {
    await catalogosApi.eliminarOrganismoAdscrito(id);
  },
};
