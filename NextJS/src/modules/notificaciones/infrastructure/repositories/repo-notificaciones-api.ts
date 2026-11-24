import type { RepoNotificaciones } from "../../domain/ports/repo-notificaciones";
import { notificacionesApi } from "../http/notificaciones-api";
import { mapperPaginaNotificaciones } from "../mappers/mapper-notificaciones";

export const repoNotificacionesApi: RepoNotificaciones = {
  async listar(filtros) {
    return mapperPaginaNotificaciones((await notificacionesApi.listar(filtros)).data);
  },
  async contarNoLeidas(modulo) {
    return (await notificacionesApi.contar(modulo)).data.no_leidas;
  },
  async consultarEstado() {
    const { no_leidas, ultima_actualizacion } = (await notificacionesApi.estado()).data;
    return { noLeidas: no_leidas, ultimaActualizacion: ultima_actualizacion };
  },
  async marcarLeida(id) {
    await notificacionesApi.marcarLeida(id);
  },
  async marcarTodasLeidas(modulo) {
    return (await notificacionesApi.marcarTodasLeidas(modulo)).data.marcadas;
  },};
