"use server";

import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import z from "zod";
import { schemaEmployeeEdit } from "../../../gestion-trabajadores/personal-trabajador/registrar/schemas/schemaRac";
import { AuthSessionExpiredError } from "@/lib/auth-errors";
import { redirect } from "next/navigation";

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
    if (message.status !== "success") {
      return {
        success: false,
        message: message.message,
      };
    }
    return {
      success: true,
      message: message.message,
    };
  } catch (error) {
    if (error instanceof AuthSessionExpiredError) redirect("/login");
    return {
      success: false,
      message: "Ocurrio un error",
    };
  }
}
