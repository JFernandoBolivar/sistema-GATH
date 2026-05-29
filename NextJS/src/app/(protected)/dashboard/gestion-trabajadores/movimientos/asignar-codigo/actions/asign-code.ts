"use server";

import z from "zod";
import { schemaAsignCode } from "../schema/schema-asign-code";
import { auth } from "#/auth";
import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";

export async function AsignCode(values: z.infer<typeof schemaAsignCode>) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return {
        success: false,
        message: "No tienes permiso para realizar esta acción. Inicia sesión.",
      };
    }
    const userId = Number.parseInt(session.user.id);
    const payload = {
      usuario_id: userId,
      employee: values.employee,
    };
    const getResponse = await apiFetch<ApiResponse<never>>(
      `asignar_codigo/${values.code}/`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return {
      success: getResponse.status === "success",
      message: getResponse.message,
    };
  } catch {
    return {
      success: false,
      message: "Ocurrio Un Error",
    };
  }
}
