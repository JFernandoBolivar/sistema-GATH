"use server";
import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { SchemaUpgradeDependnecyType } from "../schema/schemaUpdateDependency";

export default async function upgradeDependencyActions(
  values: SchemaUpgradeDependnecyType,
) {
  try {
    const { id, ...withoutId } = values;
    const data = await apiFetch<ApiResponse<never>>(
      `Dependencia/${id}/`,
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
