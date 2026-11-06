import type { ModuloNotificaciones, PaginaNotificacionesEntity } from "../entities/notificacion";

export interface FiltrosNotificaciones {
  /** Opcional: filtra una bandeja concreta. Sin él, todas las notificaciones del usuario. */
  modulo?: ModuloNotificaciones;
  /** `true` = solo leídas, `false` = solo no leídas, `undefined` = todas. */
  leida?: boolean;
  /** Texto en título o mensaje. */
  q?: string;
  tipo?: string;
  /** AAAA-MM-DD, inclusive. */
  desde?: string;
  hasta?: string;
  limite?: number;
  desplazamiento?: number;
}

export interface RepoNotificaciones {
  listar(filtros: FiltrosNotificaciones): Promise<PaginaNotificacionesEntity>;
  contarNoLeidas(modulo?: ModuloNotificaciones): Promise<number>;
  marcarLeida(id: string): Promise<void>;
  /** Marca todas las del usuario (o solo las del módulo indicado). Devuelve cuántas se marcaron. */
  marcarTodasLeidas(modulo?: ModuloNotificaciones): Promise<number>;
}
