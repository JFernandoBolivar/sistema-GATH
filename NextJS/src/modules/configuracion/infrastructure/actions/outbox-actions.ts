"use server";

/** Aviso administrativo de correos FALLIDOS (E3), sin exponer el contenido. */
import { outboxApi } from "../http/outbox-api";

export async function contarOutboxFallidosAction() {
  try {
    const { data } = await outboxApi.fallidos();
    return data ?? { total: 0, ultimos: [] };
  } catch {
    // Sin permiso o backend caído: el aviso simplemente no se muestra.
    return { total: 0, ultimos: [] };
  }
}
