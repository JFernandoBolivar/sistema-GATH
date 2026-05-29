import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { RegionTallaSchema } from "../schemas/schemaRegionTalla";

export async function regionTallaCreateActions(values: RegionTallaSchema) {
  try {
    const getResponse = await apiFetch<ApiResponse<never>>(
      "listar-region-talla/",
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
