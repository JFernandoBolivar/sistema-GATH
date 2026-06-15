import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { AdsType, AdsUpdateType } from "../schemas/schemaAds";
import { AuthSessionExpiredError } from "@/lib/auth-errors";
import { redirect } from "next/navigation";

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
  } catch (error) {
    if (error instanceof AuthSessionExpiredError) redirect("/login");
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
  } catch (error) {
    if (error instanceof AuthSessionExpiredError) redirect("/login");
    return {
      success: false,
      message: "Ocurrio Un Error en el servidor",
    };
  }
}
