"use server";

import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { AuthSessionExpiredError } from "@/lib/auth-errors";
import { redirect } from "next/navigation";

export default async function deleteRoleAction(id: number) {
  try {
    // El backend responde 409 cuando el rol tiene cuentas asociadas. apiFetch
    // no lanza excepción por el código de estado, así que el mensaje con el
    // conteo llega en el cuerpo y se propaga tal cual al usuario.
    const getResponse = await apiFetch<ApiResponse<never>>(
      `v1/identidad/roles/${id}/eliminar/`,
      {
        method: "DELETE",
      },
    );
    return {
      success: getResponse.status === "success",
      message: getResponse.message,
    };
  } catch (error) {
    if (error instanceof AuthSessionExpiredError) redirect("/login");
    return {
      success: false,
      message: "Ocurrio Un Error",
    };
  }
}
