"use server";

import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { TypeSchemaUpdateUser } from "../tableUser/updateInfo/schema/schemaUpdateUser";
import { revalidatePath } from "next/cache";

export default async function updateAction(
  values: TypeSchemaUpdateUser,
  id: number,
) {
  try {
    const getResponse = await apiFetch<ApiResponse<never>>(
      `accounts/usuarios/${id}/`,
      {
        method: "PATCH",
        body: JSON.stringify(values),
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

export async function blockUserAction(id: number, is_active: boolean) {
  const payload = {
    is_active: !is_active,
  };
  try {
    const getResponse = await apiFetch<ApiResponse<never>>(
      `accounts/usuarios/estado/${id}/`,
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
