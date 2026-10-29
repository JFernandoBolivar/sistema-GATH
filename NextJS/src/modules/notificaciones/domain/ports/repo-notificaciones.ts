import type { PaginaNotificacionesEntity } from "../entities/notificacion";

export interface FiltrosNotificaciones {
  soloNoLeidas?: boolean;
  limite?: number;
  desplazamiento?: number;
}

export interface RepoNotificaciones {
  listar(filtros?: FiltrosNotificaciones): Promise<PaginaNotificacionesEntity>;
  contarNoLeidas(): Promise<number>;
  marcarLeida(id: string): Promise<void>;
  /** Devuelve cuántas se marcaron. */
  marcarTodasLeidas(): Promise<number>;
}
