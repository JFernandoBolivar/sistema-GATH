"use server";

import { cargaMasivaApi } from "../http/carga-masiva-api";
import type {
  CargaMasivaDetalle,
  CargaMasivaResumen,
  PoblacionCarga,
} from "../../domain/entities/carga-masiva";

export async function listarCargasAction(
  poblacion?: PoblacionCarga,
  estado?: string,
): Promise<{
  success: boolean;
  data?: CargaMasivaResumen[];
  error?: string;
}> {
  try {
    const res = await cargaMasivaApi.listarCargas(poblacion, estado);
    return { success: true, data: res.data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al obtener el historial de cargas",
    };
  }
}

export async function obtenerDetalleCargaAction(
  cargaId: string,
  estadoFila?: string,
): Promise<{
  success: boolean;
  data?: CargaMasivaDetalle;
  error?: string;
}> {
  try {
    const res = await cargaMasivaApi.obtenerDetalle(cargaId, estadoFila);
    return { success: true, data: res.data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al obtener el detalle de la carga",
    };
  }
}

export async function confirmarFilasCargaAction(
  cargaId: string,
  filaIds: string[],
): Promise<{
  success: boolean;
  data?: CargaMasivaResumen;
  error?: string;
}> {
  try {
    if (filaIds.length === 0) {
      return { success: false, error: "Seleccione al menos una fila para confirmar." };
    }
    const res = await cargaMasivaApi.confirmarFilas(cargaId, filaIds);
    return { success: true, data: res.data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al confirmar las filas",
    };
  }
}

export async function aplicarCargaAction(cargaId: string): Promise<{
  success: boolean;
  data?: CargaMasivaResumen;
  error?: string;
}> {
  try {
    const res = await cargaMasivaApi.aplicar(cargaId);
    return { success: true, data: res.data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al aplicar la carga masiva",
    };
  }
}

export async function aprobarCargaAction(cargaId: string): Promise<{
  success: boolean;
  data?: CargaMasivaResumen;
  error?: string;
}> {
  try {
    const res = await cargaMasivaApi.aprobar(cargaId);
    return { success: true, data: res.data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al aprobar la carga masiva",
    };
  }
}

export async function rechazarCargaAction(
  cargaId: string,
  motivo: string,
): Promise<{
  success: boolean;
  data?: CargaMasivaResumen;
  error?: string;
}> {
  try {
    if (!motivo || motivo.trim().length === 0) {
      return { success: false, error: "Debe indicar el motivo del rechazo." };
    }
    const res = await cargaMasivaApi.rechazar(cargaId, motivo);
    return { success: true, data: res.data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al rechazar la carga masiva",
    };
  }
}

export async function revertirCargaAction(cargaId: string): Promise<{
  success: boolean;
  data?: CargaMasivaResumen;
  error?: string;
}> {
  try {
    const res = await cargaMasivaApi.revertir(cargaId);
    return { success: true, data: res.data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al revertir la carga masiva",
    };
  }
}
