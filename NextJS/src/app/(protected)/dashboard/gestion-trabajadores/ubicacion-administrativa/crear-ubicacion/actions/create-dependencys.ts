"use server";

import { z } from "zod";
import {
  schemaCreateDependency,
  schemaCreateDirectionAdm,
} from "../schema/schemaCreateDependency";
import { apiFetch } from "@/lib/api-client";
import {
  ApiResponse,
  Coordination,
  Dependency,
  DireccionGeneral,
  DireccionLinea,
} from "@/app/types/types";

export async function CreateDependencyAction(
  values: z.infer<typeof schemaCreateDirectionAdm>,
) {
  try {
    const { success } = schemaCreateDirectionAdm.safeParse(values);
    if (!success) {
      return {
        success: false,
        message: "Error En Los Campos",
      };
    }

    const getDependency = await apiFetch<ApiResponse<Dependency>>(
      `dependencia/`,
      {
        method: "POST",
        body: JSON.stringify({
          Codigo: values.dependency.Codigo,
          dependencia: values.dependency.dependencia,
        }),
      },
    );

    if (
      !values.activeCoordination &&
      !values.activeDirectionLine &&
      !values.activeDirectionGeneral
    ) {
      return {
        success: true,
        message: getDependency.message,
      };
    }
    if (getDependency.status === "success" && values.activeDirectionGeneral) {
      const getDirectionGeneral = await apiFetch<ApiResponse<DireccionGeneral>>(
        `register-direccionGeneral/`,
        {
          method: "POST",
          body: JSON.stringify({
            Codigo: values.direction_general?.Codigo,
            direccion_general: values.direction_general?.direccion_general,
            dependenciaId: getDependency.data.id,
          }),
        },
      );
      if (values.activeDirectionGeneral && !values.activeDirectionLine) {
        return {
          success: true,
          message: getDirectionGeneral.message,
        };
      }
      if (getDirectionGeneral.status === "success" && values.direction_line) {
        const getDirectionLine = await apiFetch<ApiResponse<DireccionLinea>>(
          `register-direccionLinea/`,
          {
            method: "POST",
            body: JSON.stringify({
              Codigo: values.direction_line?.Codigo,
              direccion_linea: values.direction_line?.direccion_linea,
              direccionGeneral: getDirectionGeneral.data.id,
            }),
          },
        );
        if (values.activeDirectionLine && !values.activeCoordination) {
          return {
            success: true,
            message: getDirectionLine.message,
          };
        }
        if (
          getDirectionLine.status === "success" &&
          values.activeCoordination &&
          values.activeDirectionLine &&
          values.activeDirectionGeneral
        ) {
          const getCoordination = await apiFetch<ApiResponse<Coordination>>(
            `register-Coordinacion/`,
            {
              method: "POST",
              body: JSON.stringify({
                Codigo: values.coordination?.Codigo,
                coordinacion: values.coordination?.coordinacion,
                direccionLinea: getDirectionLine.data.id,
              }),
            },
          );
          return {
            success: true,
            message: getCoordination.message,
          };
        }
      }
    }

    return {
      success: false,
      message: getDependency.message,
    };
  } catch {
    return {
      success: false,
      message: "Ocurrio Un Error",
    };
  }
}
