"use server";
import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { SchemaUpgradeDireccionLineCoord } from "../schema/schemaUpdateDireccionLineCoord";

export default async function upgradeDirectionLineCoordAction(
  values: SchemaUpgradeDireccionLineCoord,
) {
  try {
    const { id, dependenciaId, ...withoutId } = values;
    const data = await apiFetch<ApiResponse<never>>(
      `DireccionLinea/${id}/`,
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
