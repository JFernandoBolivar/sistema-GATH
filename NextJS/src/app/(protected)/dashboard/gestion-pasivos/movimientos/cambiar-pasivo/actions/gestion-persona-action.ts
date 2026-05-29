"use server";
import z from "zod";
import { schemaPasivo } from "../schema/schemaPasivo";
import { auth } from "#/auth";
import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";

export default async function GestionAction(
  values: z.infer<typeof schemaPasivo>,

  employee: string,
) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return {
        success: false,
        message: "No tienes permiso para realizar esta acción. Inicia sesión.",
      };
    }
    const payload = {
      ...values,
      usuario_id: Number.parseInt(session.user.id),
    };
    const data = await apiFetch<ApiResponse<never>>(
      `historyEmployee/egreso/${employee}/`,
      {
        method: "PATCH",
        body: JSON.stringify({
          ...payload,
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
