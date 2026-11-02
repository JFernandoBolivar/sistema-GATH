import {
  enlaceInterno,
  type ModuloNotificaciones,
  type NotificacionEntity,
} from "../../domain/entities/notificacion";
import type {
  FiltrosNotificaciones,
  RepoNotificaciones,
} from "../../domain/ports/repo-notificaciones";
import type { NotificacionDTO, PaginaNotificacionesDTO } from "../dtos/notificacion-dto";

/** Tamaño de página por defecto y techo (el servidor también lo acota a 50). */
export const LIMITE_PREDETERMINADO = 10;
export const LIMITE_MAXIMO = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function aDTO(n: NotificacionEntity): NotificacionDTO {
  return {
    id: n.id,
    tipo: n.tipo,
    titulo: n.titulo,
    mensaje: n.mensaje,
    enlace: enlaceInterno(n.enlace),
    leida: n.leida,
    fechaLectura: n.fechaLectura,
    creadaEn: n.creadaEn,
  };
}

export async function listarNotificaciones(
  repo: RepoNotificaciones,
  filtros: FiltrosNotificaciones,
): Promise<PaginaNotificacionesDTO> {
  const limite = Math.min(
    Math.max(Math.trunc(filtros.limite ?? LIMITE_PREDETERMINADO), 1),
    LIMITE_MAXIMO,
  );
  const desplazamiento = Math.max(Math.trunc(filtros.desplazamiento ?? 0), 0);
  const pagina = await repo.listar({ ...filtros, limite, desplazamiento });
  return {
    total: pagina.total,
    limite: pagina.limite,
    desplazamiento: pagina.desplazamiento,
    resultados: pagina.resultados.map(aDTO),
  };
}

export async function contarNoLeidas(
  repo: RepoNotificaciones,
  modulo: ModuloNotificaciones,
): Promise<number> {
  return Math.max(await repo.contarNoLeidas(modulo), 0);
}

export async function marcarNotificacionLeida(repo: RepoNotificaciones, id: string): Promise<void> {
  if (!UUID.test(id)) throw new Error("El identificador de la notificación no es válido.");
  await repo.marcarLeida(id);
}

export async function marcarTodasLeidas(
  repo: RepoNotificaciones,
  modulo: ModuloNotificaciones,
): Promise<number> {
  return repo.marcarTodasLeidas(modulo);
}
