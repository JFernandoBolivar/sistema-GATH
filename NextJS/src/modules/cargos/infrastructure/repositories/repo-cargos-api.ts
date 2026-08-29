/**
 * Implementación del repositorio de Cargos usando la API REST.
 */
import type { RepoCargos } from "../../domain/ports/repo-cargos";
import { cargosApi } from "../http/cargos-api";
import { cargoApiAEntidad, denominacionApiAEntidad } from "../mappers/mapper-cargos";

export const repoCargosApi: RepoCargos = {
  async listarCargos(filtros) {
    const raw = filtros?.soloVacantes
      ? await cargosApi.getVacantes()
      : await cargosApi.getCargos(
          filtros?.dependenciaId ? { dependencia_id: filtros.dependenciaId } : undefined
        );
    return raw.map(cargoApiAEntidad);
  },

  async listarDenominaciones() {
    const raw = await cargosApi.getDenominaciones();
    return raw.map(denominacionApiAEntidad);
  },

  async asignarCargo(cargoId, empleadoCedula) {
    const raw = await cargosApi.asignar(cargoId, empleadoCedula);
    return cargoApiAEntidad(raw);
  },

  async desasignarCargo(cargoId) {
    const raw = await cargosApi.desasignar(cargoId);
    return cargoApiAEntidad(raw);
  },
};
