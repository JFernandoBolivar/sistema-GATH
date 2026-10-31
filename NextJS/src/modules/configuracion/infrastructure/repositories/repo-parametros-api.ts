/** Repositorio de parámetros del sistema usando la API REST. */
import type { RepoParametros } from "../../domain/ports/repo-parametros";
import {
  parametroApiADTO,
  paginaCambiosApiADTO,
} from "../mappers/mapper-parametros";
import { parametrosApi } from "../http/parametros-api";

export const repoParametrosApi: RepoParametros = {
  async listar() {
    const envelope = await parametrosApi.listar();
    return (envelope.data ?? []).map(parametroApiADTO);
  },

  async actualizar(clave, valor) {
    const envelope = await parametrosApi.actualizar(clave, valor);
    return parametroApiADTO(envelope.data);
  },

  async historial(clave, pagina, tamano) {
    const envelope = await parametrosApi.historial(clave, pagina, tamano);
    return paginaCambiosApiADTO(envelope.data);
  },

  async diasRecordatorioFeDeVida() {
    const envelope = await parametrosApi.diasRecordatorioFeDeVida();
    return envelope.data?.dias ?? [];
  },
};
