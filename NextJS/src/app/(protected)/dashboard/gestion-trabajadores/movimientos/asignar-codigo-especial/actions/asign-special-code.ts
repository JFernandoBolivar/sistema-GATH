"use server";
import { z } from "zod";
import { schemaCodeEspecial } from "../schema/schemaCodeEspecial";
import { auth } from "#/auth";
import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";

export async function AsignSpecialCode(
  values: z.infer<typeof schemaCodeEspecial>,
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
    const getResponse = await apiFetch<ApiResponse<never>>(
      "asignacion_CodigoEspecia/",
      {
        method: "POST",
        body: JSON.stringify({ ...values, usuario_id: userId }),
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
