"use server";

import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { TypeSchemaRole } from "../registrar/schema/schemaRole";
import { AuthSessionExpiredError } from "@/lib/auth-errors";
import { redirect } from "next/navigation";

export default async function updateRoleAction(
  id: number,
  values: TypeSchemaRole,
) {
  try {
    const getResponse = await apiFetch<ApiResponse<never>>(
      `accounts/roles/${id}/update/`,
      {
        method: "PATCH",
        body: JSON.stringify(values),
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
