"use server";
import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { SchemaUpgradeCoordination } from "../schema/schemaUpdateCoordination";

export default async function upgradeCoordinationActions(
  values: SchemaUpgradeCoordination,
) {
  try {
    const { id, dependenciaId, direccionGeneral, ...withoutId } = values;
    const data = await apiFetch<ApiResponse<never>>(
      `Coordinacion/${id}/`,
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
