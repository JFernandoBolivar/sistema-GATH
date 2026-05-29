import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";

import { CategoryGroup } from "../schemas/schemaCategory";
import { PatologySchema } from "../schemas/schemaPatologys";

export async function patologyCreateActions(values: PatologySchema) {
  try {
    const data = await apiFetch<ApiResponse<never>>(
      `Patologias/`,
      {
        method: "POST",
        body: JSON.stringify(values),
      },
    );
    return { success: data.status === "success", message: data.message };
  } catch {
    return {
      success: false,
      message: "Ocurrio Un Error en el servidor",
    };
  }
}

export async function patologyGroup(values: CategoryGroup) {
  try {
    const data = await apiFetch<ApiResponse<never>>(
      `patologias/categorias/`,
      {
        method: "POST",
        body: JSON.stringify(values),
      },
    );
    return { success: data.status === "success", message: data.message };
  } catch {
    return {
      success: false,
      message: "Ocurrio Un Error en el servidor",
    };
  }
}
