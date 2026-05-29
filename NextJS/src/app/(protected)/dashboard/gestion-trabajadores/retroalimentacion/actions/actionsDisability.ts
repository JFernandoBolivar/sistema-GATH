import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { DisabitySchema } from "../schemas/schemaDisability";
import { CategoryGroup } from "../schemas/schemaCategory";

export async function disabilityCreateActions(values: DisabitySchema) {
  try {
    const data = await apiFetch<ApiResponse<never>>(
      `Discapacidades/`,
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

export async function disabilityGroup(values: CategoryGroup) {
  try {
    const data = await apiFetch<ApiResponse<never>>(
      `discapacidad/categorias/`,
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
