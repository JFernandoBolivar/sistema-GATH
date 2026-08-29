"use server";

import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { TypeSchemaUpdateUser } from "../tableUser/updateInfo/schema/schemaUpdateUser";
import { revalidatePath } from "next/cache";
import { AuthSessionExpiredError } from "@/lib/auth-errors";
import { redirect } from "next/navigation";

export default async function updateAction(
  values: TypeSchemaUpdateUser,
  id: number,
) {
  try {
    const payload: Record<string, unknown> = {};
    if (values.departamento > 0) payload.departamento_id = values.departamento;
    if (values.rol > 0) payload.rol_id = values.rol;
    if (values.password) payload.password = values.password;

    const getResponse = await apiFetch<ApiResponse<never>>(
      `v1/identidad/usuarios/${id}/`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
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

export async function blockUserAction(id: number, is_active: boolean) {
  const payload = {
    is_active: !is_active,
  };
  try {
    const getResponse = await apiFetch<ApiResponse<never>>(
      `v1/identidad/usuarios/${id}/estado/`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
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
