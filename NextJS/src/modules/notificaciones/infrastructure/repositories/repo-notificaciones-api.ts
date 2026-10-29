import type { RepoNotificaciones } from "../../domain/ports/repo-notificaciones";
import { notificacionesApi } from "../http/notificaciones-api";
import { mapperPaginaNotificaciones } from "../mappers/mapper-notificaciones";

export const repoNotificacionesApi: RepoNotificaciones = {
  async listar(filtros = {}) {
    return mapperPaginaNotificaciones((await notificacionesApi.listar(filtros)).data);
  },
  async contarNoLeidas() {
    return (await notificacionesApi.contar()).data.no_leidas;
  },
  async marcarLeida(id) {
    await notificacionesApi.marcarLeida(id);
  },
  async marcarTodasLeidas() {
    return (await notificacionesApi.marcarTodasLeidas()).data.marcadas;
  },
};
