"use server";

import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { TypeSchemaRegister } from "../schema/schemaRegister";

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
  } catch {
    return {
      success: false,
      message: "Ocurrio Un Error",
    };
  }
}
