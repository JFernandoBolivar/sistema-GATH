"use server";

import { auth } from "#/auth";
import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { UpdateCodeTable } from "../schema/schema-update-code";

export async function updateCodeTable(values: UpdateCodeTable, id: number) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return {
        success: false,
        message: "No tienes permiso para realizar esta acción. Inicia sesión.",
      };
    }
    const { ...valuesNotCode } = values;
    const userId = Number.parseInt(session.user.id);
    const payload = {
      usuario_id: userId,
      ...valuesNotCode,
    };
    const data = await apiFetch<ApiResponse<never>>(
      `cargos/pasivo/${id}/`,
      {
        method: "PUT",
        body: JSON.stringify({ ...payload }),
      },
    );
    return { success: data.status === "success", message: data.message };
  } catch {
    return {
      success: false,
      message: "Ocurrio un error",
    };
  }
}
