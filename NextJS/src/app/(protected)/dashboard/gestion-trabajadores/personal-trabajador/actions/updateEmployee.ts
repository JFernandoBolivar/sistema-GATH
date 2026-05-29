"use server";

import { ApiResponse } from "@/app/types/types";
import z from "zod";
import { schemaEmployeeEdit } from "../registrar/schemas/schemaRac";
import { apiFetch } from "@/lib/api-client";

export async function updateEmployee(
  values: z.infer<typeof schemaEmployeeEdit>,
  cedula: string,
) {
  try {
    const { success } = schemaEmployeeEdit.safeParse(values);
    if (!success) {
      return {
        success: false,
        message: "Error En Los Campos De Actualizacion",
      };
    }
    const message = await apiFetch<ApiResponse<string>>(
      `empleados-actualizar/${cedula}/`,
      {
        method: "PATCH",
        body: JSON.stringify(values),
      },
    );
    return {
      success: message.status === "success",
      message: message.message,
    };
  } catch {
    return {
      success: false,
      message: "Ocurrio un error",
    };
  }
}
