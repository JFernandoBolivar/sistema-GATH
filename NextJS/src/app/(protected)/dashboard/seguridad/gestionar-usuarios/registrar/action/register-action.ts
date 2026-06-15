"use server";

import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { TypeSchemaRegister } from "../schema/schemaRegister";
import { AuthSessionExpiredError } from "@/lib/auth-errors";
import { redirect } from "next/navigation";

export default async function registerAction(values: TypeSchemaRegister) {
  try {
    const getResponse = await apiFetch<ApiResponse<never>>(
      "accounts/registro/",
      {
        method: "POST",
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
