import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { TallaSchema } from "../schemas/schemaTalla";
import { AuthSessionExpiredError } from "@/lib/auth-errors";
import { redirect } from "next/navigation";

export async function tallaCreateActions(values: TallaSchema) {
  try {
    const getResponse = await apiFetch<ApiResponse<never>>(
      "listar-tallas/",
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
      message: "Ocurrio Un Error en el servidor",
    };
  }
}
