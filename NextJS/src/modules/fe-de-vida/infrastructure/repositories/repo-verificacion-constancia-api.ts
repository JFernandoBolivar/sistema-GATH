import type { RepoVerificacionConstancia } from "../../domain/ports/repo-verificacion-constancia";
import { feDeVidaApi } from "../http/fe-de-vida-api";
import { mapperVerificacion } from "../mappers/mapper-verificacion-constancia";

export const repoVerificacionConstanciaApi: RepoVerificacionConstancia = {
  async verificarPublica(codigo) {
    return mapperVerificacion((await feDeVidaApi.verificacionPublica(codigo)).data);
  },
  async verificarInterna(codigo) {
    return mapperVerificacion((await feDeVidaApi.verificacionInterna(codigo)).data);
  },
};
