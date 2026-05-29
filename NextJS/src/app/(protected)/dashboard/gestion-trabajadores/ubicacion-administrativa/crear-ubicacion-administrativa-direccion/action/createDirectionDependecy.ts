"use server";
import z from "zod";
import {
  schemaCreateCoordinationDirection,
  schemaCreateDirectionGeneralDp,
  schemaCreateDirectionLineDirection,
} from "../schema/schemaCreateDirectionDependency";
import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
export async function createDirectionGeneral(
  values: z.infer<typeof schemaCreateDirectionGeneralDp>,
) {
  try {
    const { success } = schemaCreateDirectionGeneralDp.safeParse(values);
    if (!success) {
      return {
        success: false,
        message: "Error Al Validar Los Datos",
      };
    }
    const data = await apiFetch<ApiResponse<never>>(
      `register-direccionGeneral/`,
      {
        method: "POST",
        body: JSON.stringify({ ...values }),
      },
    );
    return { success: data.status === "success", message: data.message };
  } catch {
    return {
      success: false,
      message: "Ocurrio Un Error",
    };
  }
}

export async function createDirectionLine(
  values: z.infer<typeof schemaCreateDirectionLineDirection>,
) {
  try {
    const { success } = schemaCreateDirectionLineDirection.safeParse(values);
    if (!success) {
      return {
        success: false,
        message: "Error Al Validar Los Datos",
      };
    }
    const data = await apiFetch<ApiResponse<never>>(
      `register-direccionLinea/`,
      {
        method: "POST",
        body: JSON.stringify({ ...values }),
      },
    );
    return { success: data.status === "success", message: data.message };
  } catch {
    return {
      success: false,
      message: "Ocurrio Un Error",
    };
  }
}
export async function createDirectionCordination(
  values: z.infer<typeof schemaCreateCoordinationDirection>,
) {
  const { success } = schemaCreateCoordinationDirection.safeParse(values);
  if (!success) {
    return {
      success: false,
      message: "Error Al Validar Los Datos",
    };
  }
  try {
    const data = await apiFetch<ApiResponse<never>>(
      `register-Coordinacion/`,
      {
        method: "POST",
        body: JSON.stringify({ ...values }),
      },
    );
    return { success: data.status === "success", message: data.message };
  } catch {
    return {
      success: false,
      message: "Ocurrio Un Error",
    };
  }
}
