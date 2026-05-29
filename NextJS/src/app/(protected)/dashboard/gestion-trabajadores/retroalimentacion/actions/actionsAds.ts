import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { AdsType, AdsUpdateType } from "../schemas/schemaAds";

export async function adsCreateActions(values: AdsType) {
  try {
    const data = await apiFetch<ApiResponse<never>>(
      `OrganismoAdscrito/`,
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
export async function adsUpdateActions(values: AdsUpdateType) {
  try {
    const { id, ...ads } = values;
    const data = await apiFetch<ApiResponse<never>>(
      `OrganismoAdscrito/${id}/`,
      {
        method: "PATCH",
        body: JSON.stringify({ ...ads }),
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
