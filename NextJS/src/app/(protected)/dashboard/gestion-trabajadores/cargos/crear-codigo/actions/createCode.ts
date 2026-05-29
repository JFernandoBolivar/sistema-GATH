"use server";

import z from "zod";
import { schemaCode } from "../schemas/schemaCode";
import { auth } from "#/auth";
import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";

export async function createCodeAction(values: z.infer<typeof schemaCode>) {
  try {
    const { success, error } = schemaCode.safeParse(values);
    const session = await auth();
    if (!session || !session.user?.id) {
      return {
        success: false,
        message: "No tienes permiso para realizar esta acción. Inicia sesión.",
      };
    }

    const userId = Number.parseInt(session.user.id);
    if (!success) {
      return {
        success: false,
        message: error.message,
      };
    }
    const payload = { ...values, usuario_id: userId };
    const data = await apiFetch<ApiResponse<never>>(
      `empleados-codigo/`,
      {
        method: "POST",
        body: JSON.stringify({ ...payload }),
      },
    );
    if (data.status !== "success") {
      return {
        success: false,
        message: data.message || "Error al crear el código.",
      };
    }
    return {
      success: true,
      message: data.message,
    };
  } catch {
    return {
      success: false,
      message: "Ocurrio un error Inesperado",
    };
  }
}
