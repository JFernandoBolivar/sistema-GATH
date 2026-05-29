"use server";

import z from "zod";
import { schemaStatusChange } from "../schema/schemaChangeStatus";
import { auth } from "#/auth";
import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";

export default async function ChangeStatusAction(
  values: z.infer<typeof schemaStatusChange>,
) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return {
        success: false,
        message: "No tienes permiso para realizar esta acción. Inicia sesión.",
      };
    }

    const userId = Number.parseInt(session.user.id);
    const data = await apiFetch<ApiResponse<never>>(
      `historyEmployee/Estatus/${values.cargo}/`,
      {
        method: "PATCH",
        body: JSON.stringify({
          estatus_id: values.estatus_id,
          usuario_id: userId,
          motivo: values.motivo,
        }),
      },
    );
    return { success: data.status === "success", message: data.message };
  } catch {
    return {
      success: false,
      message: "Ocurrio Un Error",
    };
  }
}
