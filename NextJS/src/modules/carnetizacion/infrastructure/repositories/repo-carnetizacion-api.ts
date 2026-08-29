/**
 * Implementación del repositorio de Carnetización usando la API REST.
 */
import type { RepoCarnetizacion } from "../../domain/ports/repo-carnetizacion";
import { carnetizacionApi } from "../http/carnetizacion-api";
import { carnetApiAEntidad, plantillaCarnetApiAEntidad } from "../mappers/mapper-carnetizacion";

export const repoCarnetizacionApi: RepoCarnetizacion = {
  async listarCarnets(cedula) {
    const raw = await carnetizacionApi.getCarnets(cedula);
    return raw.map(carnetApiAEntidad);
  },

  async emitirCarnet(empleadoCedula, motivoId, observaciones) {
    const raw = await carnetizacionApi.emitir(empleadoCedula, motivoId, observaciones);
    return carnetApiAEntidad(raw);
  },

  async validarPorHash(securityHash) {
    const res = await carnetizacionApi.validarPorHash(securityHash);
    return {
      esValido: res.es_valido,
      mensaje: res.mensaje,
      carnet: res.carnet ? carnetApiAEntidad(res.carnet) : null,
    };
  },

  async validarPorId(carnetId) {
    const res = await carnetizacionApi.validarPorId(carnetId);
    return {
      esValido: res.es_valido,
      mensaje: res.mensaje,
      carnet: res.carnet ? carnetApiAEntidad(res.carnet) : null,
    };
  },

  async listarPlantillas() {
    const raw = await carnetizacionApi.getPlantillas();
    return raw.map(plantillaCarnetApiAEntidad);
  },

  async activarPlantilla(plantillaId) {
    const raw = await carnetizacionApi.activarPlantilla(plantillaId);
    return plantillaCarnetApiAEntidad(raw);
  },

  async descargarPdf(carnetId) {
    return carnetizacionApi.descargarPdf(carnetId);
  },
};
