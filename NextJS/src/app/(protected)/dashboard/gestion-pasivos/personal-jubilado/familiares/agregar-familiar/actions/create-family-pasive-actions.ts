"use server";

import z from "zod";
import { schemaFamilyEmployeeOne } from "../schema/schemaCreateFamily";
import { auth } from "#/auth";
import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";

export default async function createFamilyPasiveActions(
  values: z.infer<typeof schemaFamilyEmployeeOne>,
  id: string | number,
) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return {
        success: false,
        message: "No tienes permiso para realizar esta acción. Inicia sesión.",
      };
    }

    const {
      file_cedula: _file_cedula,
      file_partida_nacimiento: _file_partida_nacimiento,
      ...familyData
    } = values;

    interface FamilyCreateResponse {
      id: number;
      cedulaFamiliar: string;
      nombre_completo: string;
      parentesco: string;
    }
    const data = await apiFetch<ApiResponse<FamilyCreateResponse>>(
      `Employeefamily/${id}/`,
      {
        method: "POST",
        body: JSON.stringify({ ...familyData, usuario_id: session.user.id }),
      },
    );
    if (data.status === "success") {
      return {
        success: true,
        message: data.message,
        data: data.data,
      };
    }
    return {
      success: false,
      message: data.message,
    };
  } catch {
    return {
      success: false,
      message: "Ocurrio un error",
    };
  }
}
