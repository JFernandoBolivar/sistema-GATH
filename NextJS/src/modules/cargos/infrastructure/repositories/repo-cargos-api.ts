/**
 * Implementación del repositorio de Cargos usando la API REST.
 */
import type {
  RepoCargos,
  CrearCargoInput,
  CrearPrestamoInput,
  DenominacionInput,
} from "../../domain/ports/repo-cargos";
import { cargosApi } from "../http/cargos-api";
import {
  cargoApiAEntidad,
  catalogoApiAEntidad,
  denominacionApiAEntidad,
  prestamoApiAEntidad,
  unidadOrganizativaApiAEntidad,
} from "../mappers/mapper-cargos";

export const repoCargosApi: RepoCargos = {
  async listarCargos(filtros) {
    const raw = filtros?.soloVacantes
      ? await cargosApi.getVacantes(
          filtros?.dependenciaId ? { dependencia_id: filtros.dependenciaId } : undefined,
        )
      : await cargosApi.getCargos(
          filtros?.dependenciaId ? { dependencia_id: filtros.dependenciaId } : undefined,
        );
    return raw.map(cargoApiAEntidad);
  },

  async listarDenominaciones() {
    return (await cargosApi.getDenominaciones()).map(denominacionApiAEntidad);
  },

  async listarDenominacionesEspecificas() {
    return (await cargosApi.getDenominacionesEspecificas()).map(denominacionApiAEntidad);
  },

  async asignarCargo(cargoId, empleadoCedula) {
    return cargoApiAEntidad(await cargosApi.asignar(cargoId, empleadoCedula));
  },

  async desasignarCargo(cargoId) {
    return cargoApiAEntidad(await cargosApi.desasignar(cargoId));
  },

  async cambiarCargo(cargoActualId, cargoNuevoId, motivoId) {
    return cargoApiAEntidad(
      await cargosApi.cambiarCargo(cargoActualId, { cargo_nuevo_id: cargoNuevoId, motivo_id: motivoId }),
    );
  },

  async gestionarEstatus(cargoId, estatusId, motivoId) {
    return cargoApiAEntidad(
      await cargosApi.gestionarEstatus(cargoId, { estatus_id: estatusId, motivo_id: motivoId }),
    );
  },

  async listarPrestamos(soloActivos) {
    return (await cargosApi.getPrestamos(soloActivos)).map(prestamoApiAEntidad);
  },

  async crearPrestamo(input: CrearPrestamoInput) {
    return prestamoApiAEntidad(
      await cargosApi.crearPrestamo({
        cedula_encargado: input.cedulaEncargado,
        cargo_id: input.cargoId,
        motivo_id: input.motivoId,
        fecha_inicio: input.fechaInicio,
        fecha_fin: input.fechaFin,
      }),
    );
  },

  async finalizarPrestamo(prestamoId) {
    return prestamoApiAEntidad(await cargosApi.finalizarPrestamo(prestamoId));
  },

  async crearDenominacion(input: DenominacionInput) {
    return denominacionApiAEntidad(await cargosApi.crearDenominacion({ nombre: input.nombre, orden: input.orden }));
  },

  async actualizarDenominacion(id, input: DenominacionInput) {
    return denominacionApiAEntidad(
      await cargosApi.actualizarDenominacion(id, { nombre: input.nombre, orden: input.orden }),
    );
  },

  async eliminarDenominacion(id) {
    await cargosApi.eliminarDenominacion(id);
  },

  async crearDenominacionEspecifica(input: DenominacionInput) {
    return denominacionApiAEntidad(
      await cargosApi.crearDenominacionEspecifica({ nombre: input.nombre, orden: input.orden }),
    );
  },

  async actualizarDenominacionEspecifica(id, input: DenominacionInput) {
    return denominacionApiAEntidad(
      await cargosApi.actualizarDenominacionEspecifica(id, { nombre: input.nombre, orden: input.orden }),
    );
  },

  async eliminarDenominacionEspecifica(id) {
    await cargosApi.eliminarDenominacionEspecifica(id);
  },

  async listarMotivos() {
    return (await cargosApi.getMotivos()).map(catalogoApiAEntidad);
  },

  async listarEstatus() {
    return (await cargosApi.getEstatus()).map(catalogoApiAEntidad);
  },

  async crearCargo(input: CrearCargoInput) {
    return cargoApiAEntidad(
      await cargosApi.crearCargo({
        denominacion_id: input.denominacionId,
        especifica_id: input.especificaId,
        tipo_nomina_id: input.tipoNominaId,
        dependencia_id: input.dependenciaId,
        direccion_general_id: input.direccionGeneralId,
        direccion_linea_id: input.direccionLineaId,
        coordinacion_id: input.coordinacionId,
        organismo_id: input.organismoId,
        grado_id: input.gradoId,
        observaciones: input.observaciones,
      }),
    );
  },

  async listarTiposNomina() {
    return (await cargosApi.getTiposNomina()).map(catalogoApiAEntidad);
  },

  async listarGrados() {
    return (await cargosApi.getGrados()).map(catalogoApiAEntidad);
  },

  async listarOrganismosAdscritos() {
    return (await cargosApi.getOrganismosAdscritos()).map(catalogoApiAEntidad);
  },

  async listarDependencias() {
    return (await cargosApi.getDependencias()).map(unidadOrganizativaApiAEntidad);
  },

  async listarDireccionesGenerales(dependenciaId) {
    return (await cargosApi.getDireccionesGenerales(dependenciaId)).map(unidadOrganizativaApiAEntidad);
  },

  async listarDireccionesLinea(direccionGeneralId) {
    return (await cargosApi.getDireccionesLinea(direccionGeneralId)).map(unidadOrganizativaApiAEntidad);
  },

  async listarCoordinaciones(direccionLineaId) {
    return (await cargosApi.getCoordinaciones(direccionLineaId)).map(unidadOrganizativaApiAEntidad);
  },
};
