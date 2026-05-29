"use server";
import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { SchemaUpgradeDireccionGeneralCoord } from "../schema/schemaUpdateDireccionGeneralCoord";

export default async function upgradeDirectionGeneralCoordAction(
  values: SchemaUpgradeDireccionGeneralCoord,
) {
  try {
    const { id, ...withoutId } = values;
    const data = await apiFetch<ApiResponse<never>>(
      `DireccionGeneral/${id}/`,
      {
        method: "PATCH",
        body: JSON.stringify(withoutId),
      },
    );
    return { success: data.status === "success", message: data.message };
  } catch {
    return {
      success: false,
      message: "Error En El Servidor",
    };
  }
}
