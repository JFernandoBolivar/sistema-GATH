"use server";

import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { errorDeAccion, handleSessionExpired } from "@/shared/infrastructure/http/errors";
import type { RegistroGuiaVista } from "./tipos-guia";

const RUTA_GUIAS = "/api/v1/autogestion/guias/";

export async function consultarGuiasVistasAction(): Promise<{
  ok: boolean;
  vistas: Record<string, number>;
}> {
  try {
    const res = await apiClient.get<RegistroGuiaVista[]>(RUTA_GUIAS);
    const lista = Array.isArray(res) ? res : [];
    const vistas: Record<string, number> = {};
    for (const item of lista) {
      if (!vistas[item.guia_id] || item.version > vistas[item.guia_id]) {
        vistas[item.guia_id] = item.version;
      }
    }
    return { ok: true, vistas };
  } catch (error) {
    handleSessionExpired(error);
    return { ok: false, vistas: {} };
  }
}

export async function marcarGuiaVistaAction(
  guiaId: string,
  version: number,
): Promise<{ ok: boolean; mensaje?: string }> {
  try {
    await apiClient.post<{ guia_id: string; version: number }>(RUTA_GUIAS, {
      guia_id: guiaId,
      version,
    });
    return { ok: true };
  } catch (error) {
    handleSessionExpired(error);
    const err = errorDeAccion(error, "No se pudo registrar la visualización de la guía.");
    return { ok: false, mensaje: err.error };
  }
}
