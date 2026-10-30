"use server";

import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import type { ModuloNotificaciones } from "../../domain/entities/notificacion";
import type { FiltrosNotificaciones } from "../../domain/ports/repo-notificaciones";
import type {
  PaginaNotificacionesDTO,
  ResultadoNotificacion,
} from "../../application/dtos/notificacion-dto";
import {
  contarNoLeidas,
  listarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
} from "../../application/use-cases/gestionar-notificaciones";
import { repoNotificacionesApi } from "../repositories/repo-notificaciones-api";

/** Convierte errores en mensajes en español (en producción Next oculta el texto de las excepciones). */
async function ejecutar<T>(
  mensajeOk: string,
  mensajeError: string,
  fn: () => Promise<T>,
): Promise<ResultadoNotificacion<T>> {
  try {
    return { ok: true, mensaje: mensajeOk, datos: await fn() };
  } catch (error) {
    handleSessionExpired(error);
    return {
      ok: false,
      mensaje: error instanceof Error && error.message ? error.message : mensajeError,
    };
  }
}

export async function listarNotificacionesAction(
  filtros: FiltrosNotificaciones,
): Promise<ResultadoNotificacion<PaginaNotificacionesDTO>> {
  return ejecutar("", "No se pudieron cargar sus notificaciones.", () =>
    listarNotificaciones(repoNotificacionesApi, filtros),
  );
}

export async function contarNoLeidasAction(
  modulo: ModuloNotificaciones,
): Promise<ResultadoNotificacion<number>> {
  return ejecutar("", "No se pudo consultar el número de notificaciones.", () =>
    contarNoLeidas(repoNotificacionesApi, modulo),
  );
}

export async function marcarLeidaAction(id: string): Promise<ResultadoNotificacion> {
  return ejecutar(
    "Notificación marcada como leída.",
    "No se pudo marcar la notificación.",
    async () => {
      await marcarNotificacionLeida(repoNotificacionesApi, id);
      return undefined;
    },
  );
}

export async function marcarTodasLeidasAction(
  modulo: ModuloNotificaciones,
): Promise<ResultadoNotificacion<number>> {
  return ejecutar(
    "Notificaciones marcadas como leídas.",
    "No se pudieron marcar las notificaciones.",
    () => marcarTodasLeidas(repoNotificacionesApi, modulo),
  );
}
