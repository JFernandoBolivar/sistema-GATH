"use server";

import { auth } from "#/auth";
import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import { AcademyUpdateUpdateType } from "@/shared/schemas/employees/update/schema-academic_training";
import { BackgroundUpdateType } from "@/shared/schemas/employees/update/schema-background";
import { DwellingUpdateType } from "@/shared/schemas/employees/update/schema-dwelling";
import { HealthUpdateType } from "@/shared/schemas/employees/update/schema-health_profile";
import { PhysicalProfileUpdateType } from "@/shared/schemas/employees/update/schema-physical_profile";
import { BasicInfoUpdateType } from "@/shared/schemas/employees/update/schemaEmployeeUpdate";
import { SupplementaryTrainingUpdateType } from "@/shared/schemas/employees/update/schema-supplementary_training";
import { ContratoUpdateType } from "@/shared/schemas/employees/update/schema-contrato";
import { createCarrera, createCapacitacion, createInstitucion, createMencion, createOrganismoAdscrito } from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";

export default async function updateInfoEmployee(
  data:
    | PhysicalProfileUpdateType
    | BackgroundUpdateType
    | HealthUpdateType
    | DwellingUpdateType
    | AcademyUpdateUpdateType
    | BasicInfoUpdateType
    | SupplementaryTrainingUpdateType
    | ContratoUpdateType,
  idEmployee: string,
  cedulaidentidad?: string,
) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return {
        success: false,
        message: "No tienes permiso para realizar esta acción. Inicia sesión.",
      };
    }

    let payload = { ...data } as Record<string, unknown>;

    if ("formacion_academica" in data && Array.isArray(data.formacion_academica)) {
      const formacionAcademicaProcesada = await Promise.all(
        data.formacion_academica.map(async (item: Record<string, unknown>) => {
          let processed = { ...item };

          if (item.carrera_id === -1 && typeof item.nueva_carrera_nombre === "string" && item.nueva_carrera_nombre.trim()) {
            console.log("[updateInfoEmployee] creating carrera:", item.nueva_carrera_nombre.trim(), "level:", item.nivel_Academico_id);
            const result = await createCarrera(
              item.nueva_carrera_nombre.trim(),
              item.nivel_Academico_id as number,
            );
            console.log("[updateInfoEmployee] createCarrera result:", JSON.stringify(result));
            if (result.status === "success" && result.data?.id) {
              console.log("[updateInfoEmployee] carrera created with id:", result.data.id);
              processed = { ...processed, carrera_id: result.data.id, nueva_carrera_nombre: undefined };
            } else {
              console.log("[updateInfoEmployee] createCarrera FAILED, removing carrera fields");
              processed = { ...processed, carrera_id: undefined, nueva_carrera_nombre: undefined };
            }
          }

          if (item.institucion_id === -1 && typeof item.nueva_institucion_nombre === "string" && item.nueva_institucion_nombre.trim()) {
            console.log("[updateInfoEmployee] creating institucion:", item.nueva_institucion_nombre.trim());
            const result = await createInstitucion(item.nueva_institucion_nombre.trim());
            console.log("[updateInfoEmployee] createInstitucion result:", JSON.stringify(result));
            if (result.status === "success" && result.data?.id) {
              console.log("[updateInfoEmployee] institucion created with id:", result.data.id);
              processed = { ...processed, institucion_id: result.data.id, nueva_institucion_nombre: undefined };
            } else {
              console.log("[updateInfoEmployee] createInstitucion FAILED, removing institucion fields");
              processed = { ...processed, institucion_id: undefined, nueva_institucion_nombre: undefined };
            }
          }

          if (item.mencion_id === -1 && typeof item.nueva_mencion_nombre === "string" && item.nueva_mencion_nombre.trim() && typeof processed.carrera_id === "number" && processed.carrera_id > 0) {
            console.log("[updateInfoEmployee] creating mencion:", item.nueva_mencion_nombre.trim(), "carrera:", processed.carrera_id);
            const result = await createMencion(item.nueva_mencion_nombre.trim(), processed.carrera_id as number);
            console.log("[updateInfoEmployee] createMencion result:", JSON.stringify(result));
            if (result.status === "success" && result.data?.[0]?.id) {
              console.log("[updateInfoEmployee] mencion created with id:", result.data[0].id);
              processed = { ...processed, mencion_id: result.data[0].id, nueva_mencion_nombre: undefined };
            } else {
              console.log("[updateInfoEmployee] createMencion FAILED, removing mencion fields");
              processed = { ...processed, mencion_id: undefined, nueva_mencion_nombre: undefined };
            }
          }

          return processed;
        }),
      );
      payload = { ...payload, formacion_academica: formacionAcademicaProcesada };
    }

    if ("formacion_complementaria" in data && Array.isArray(data.formacion_complementaria)) {
      const formacionComplementariaProcesada = await Promise.all(
        data.formacion_complementaria.map(async (item: Record<string, unknown>) => {
          let processed = { ...item };
          if (item.capacitacion_id === -1 && typeof item.nueva_capacitacion_nombre === "string" && item.nueva_capacitacion_nombre.trim()) {
            const result = await createCapacitacion(item.nueva_capacitacion_nombre.trim());
            if (result.status === "success" && result.data?.id) {
              processed = { ...processed, capacitacion_id: result.data.id, nueva_capacitacion_nombre: undefined };
            }
          }
          if (item.institucion_id === -1 && typeof item.nueva_institucion_nombre === "string" && item.nueva_institucion_nombre.trim()) {
            const result = await createInstitucion(item.nueva_institucion_nombre.trim());
            if (result.status === "success" && result.data?.id) {
              processed = { ...processed, institucion_id: result.data.id, nueva_institucion_nombre: undefined };
            }
          }
          return processed;
        }),
      );
      payload = { ...payload, formacion_complementaria: formacionComplementariaProcesada };
    }

    if ("antecedentes" in data && Array.isArray(data.antecedentes)) {
      const antecedentesProcesados = await Promise.all(
        data.antecedentes.map(async (item: Record<string, unknown>) => {
          let processed = { ...item };
          if (item.organismo_id === -1 && typeof item.nuevo_organismo_nombre === "string" && item.nuevo_organismo_nombre.trim()) {
            const result = await createOrganismoAdscrito(item.nuevo_organismo_nombre.trim());
            if (result.status === "success" && result.data?.id) {
              processed = { ...processed, organismo_id: result.data.id, nuevo_organismo_nombre: undefined };
            } else {
              processed = { ...processed, organismo_id: undefined, nuevo_organismo_nombre: undefined };
            }
          }
          return processed;
        }),
      );
      payload = { ...payload, antecedentes: antecedentesProcesados };
    }

    const userId = Number.parseInt(session.user.id);
    const getResponse = await apiFetch<ApiResponse<never>>(
      `Employee/${idEmployee}/`,
      {
        method: "PATCH",
        body: JSON.stringify({
          ...payload,
          usuario_id: userId,
        }),
      },
    );
    console.log("[updateInfoEmployee] payload:", JSON.stringify({ ...payload, usuario_id: userId }, null, 2));
    console.log("[updateInfoEmployee] response:", JSON.stringify(getResponse, null, 2));
    if ("file" in data && data.file !== null && data.file !== undefined) {
      const formData = new FormData();
      formData.append("file", data.file!);
      await fetch(
        `${process.env.NEXT_PUBLIC_NEST_API_URL_SERVER}file-save/upload/profile/${cedulaidentidad}`,

        {
          method: "POST",
          body: formData,
        },
      );
      await apiFetch<ApiResponse<never>>(
        `Employee/${idEmployee}/`,
        {
          method: "PATCH",
          body: JSON.stringify({
            profile: data.file.name,
            usuario_id: userId,
          }),
        },
      );
    }

    if (getResponse.status === "success") {
      return {
        success: true,
        message: getResponse.message,
      };
    }
    return {
      success: false,
      message:
        getResponse.message ||
        "Error al actualizar la información del empleado.",
    };
  } catch {
    return {
      success: false,
      message: "Ocurrio Un Error",
    };
  }
}
