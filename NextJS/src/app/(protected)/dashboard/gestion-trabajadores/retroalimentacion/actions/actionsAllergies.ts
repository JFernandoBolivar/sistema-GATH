import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";

import { CategoryGroup } from "../schemas/schemaCategory";
import { AllergiesSchema } from "../schemas/schemaAllergies";

export async function allergiesCreateActions(values: AllergiesSchema) {
  try {
    const data = await apiFetch<ApiResponse<never>>(
      `alergias/`,
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

export async function allergiesGroup(values: CategoryGroup) {
  try {
    const data = await apiFetch<ApiResponse<never>>(
      `alergias/categorias/`,
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
