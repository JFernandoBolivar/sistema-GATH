"use server";

import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { TypeSchemaRegister } from "../schema/schemaRegister";
import { AuthSessionExpiredError } from "@/lib/auth-errors";
import { redirect } from "next/navigation";

export default async function registerAction(values: TypeSchemaRegister) {
  try {
    const getResponse = await apiFetch<ApiResponse<never>>(
      "v1/identidad/usuarios/",
      {
        method: "POST",
        body: JSON.stringify({
          cedula: values.cedula,
          password: values.password,
          departamento_id: values.departamento,
          rol_id: values.rol,
        }),
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
