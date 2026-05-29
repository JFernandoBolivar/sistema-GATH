import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { TallaSchema } from "../schemas/schemaTalla";

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
  } catch {
    return {
      success: false,
      message: "Ocurrio Un Error en el servidor",
    };
  }
}
