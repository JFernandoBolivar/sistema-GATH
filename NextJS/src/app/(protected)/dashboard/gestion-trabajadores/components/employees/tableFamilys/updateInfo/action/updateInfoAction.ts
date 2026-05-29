"use server";

import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { HealthUpdateFamilyType } from "../schema/schema-health_profile";
import { TypeSchemaUpdateAcademy } from "../schema/schemaAcademyUpdate";
import { SchemaUpdatePhysical } from "../schema/schemaPhysicalUpdate";
import { UpdateInfoFormValues } from "../schema/updateInfoSchema";
import { SchemaUpdateRelaction } from "../schema/updateRelationSchema";

export default async function updateInfoAction({
  values,
  idFamily,
}: {
  values:
    | HealthUpdateFamilyType
    | TypeSchemaUpdateAcademy
    | SchemaUpdatePhysical
    | UpdateInfoFormValues
    | SchemaUpdateRelaction;
  idFamily: number;
}) {
  try {
    const data = await apiFetch<ApiResponse<never>>(
      `Employeefamily/${idFamily}`,
      {
        method: "PATCH",
        body: JSON.stringify(values),
      },
    );
    return { success: data.status === "success", message: data.message };
  } catch {
    return {
      success: false,
      message: "Error al actualizar la información",
    };
  }
}
