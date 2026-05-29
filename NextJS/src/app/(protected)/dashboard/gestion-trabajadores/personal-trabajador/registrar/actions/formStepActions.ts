"use server";
import { auth } from "#/auth";
import { BasicInfoType } from "@/shared/schemas/employees/register/schema-basic-info";
import { AcademyType } from "@/shared/schemas/employees/register/schema-academic_training";
import { BackgroundType } from "@/shared/schemas/employees/register/schema-background";
import { SupplementaryTrainingType } from "@/shared/schemas/employees/register/schema-supplementary_training";
import { HealthType } from "@/shared/schemas/employees/register/schema-health_profile";
import { PhysicalProfileType } from "@/shared/schemas/employees/register/schema-physical_profile";
import { DwellingType } from "@/shared/schemas/employees/register/schema-dwelling";
import { FamilyEmployeeType } from "@/shared/schemas/employees/register/schema-family_employee";
import { ApiResponse } from "@/app/types/types";
import { createCarrera, createCapacitacion, createInstitucion, createMencion, createOrganismoAdscrito } from "../../../api/getInfoRac";
import { apiFetch } from "@/lib/api-client";

export async function registerEmployeeSteps(
  data: BasicInfoType &
    AcademyType &
    SupplementaryTrainingType &
    BackgroundType &
    HealthType &
    PhysicalProfileType &
    DwellingType,
) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return {
        success: false,
        message: "No tienes permiso para realizar esta acción. Inicia sesión.",
      };
    }

    const userId = Number.parseInt(session.user.id);
    const {
      apellidos,
      cedulaidentidad,
      carnet_patria,
      datos_vivienda,
      estadoCivil,
      fecha_nacimiento,
      file,
      formacion_academica,
      formacion_complementaria,
      nombres,
      perfil_fisico,
      perfil_salud,
      sexoid,
      antecedentes,
    } = data;

    const formacionAcademicaProcesada = formacion_academica
      ? await Promise.all(
          formacion_academica.map(async (item) => {
            let processed = { ...item };
            if (item.carrera_id === -1 && item.nueva_carrera_nombre?.trim()) {
              const result = await createCarrera(item.nueva_carrera_nombre.trim(), item.nivel_Academico_id);
              if (result.status === "success" && result.data?.id) {
                processed = { ...processed, carrera_id: result.data.id, nueva_carrera_nombre: undefined };
              } else {
                processed = { ...processed, carrera_id: undefined, nueva_carrera_nombre: undefined };
              }
            }
            if (item.institucion_id === -1 && item.nueva_institucion_nombre?.trim()) {
              const result = await createInstitucion(item.nueva_institucion_nombre.trim());
              if (result.status === "success" && result.data?.id) {
                processed = { ...processed, institucion_id: result.data.id, nueva_institucion_nombre: undefined };
              } else {
                processed = { ...processed, institucion_id: undefined, nueva_institucion_nombre: undefined };
              }
            }
            if (item.mencion_id === -1 && item.nueva_mencion_nombre?.trim() && typeof processed.carrera_id === "number" && processed.carrera_id > 0) {
              const result = await createMencion(item.nueva_mencion_nombre.trim(), processed.carrera_id);
              if (result.status === "success" && result.data?.[0]?.id) {
                processed = { ...processed, mencion_id: result.data[0].id, nueva_mencion_nombre: undefined };
              } else {
                processed = { ...processed, mencion_id: undefined, nueva_mencion_nombre: undefined };
              }
            }
            return processed;
          }),
        )
      : [];

    const formacionComplementariaProcesada = formacion_complementaria
      ? await Promise.all(
          formacion_complementaria.map(async (item) => {
            let processed = { ...item };
            if (item.capacitacion_id === -1 && item.nueva_capacitacion_nombre?.trim()) {
              const result = await createCapacitacion(item.nueva_capacitacion_nombre.trim());
              if (result.status === "success" && result.data?.id) {
                processed = { ...processed, capacitacion_id: result.data.id, nueva_capacitacion_nombre: undefined };
              }
            }
            if (item.institucion_id === -1 && item.nueva_institucion_nombre?.trim()) {
              const result = await createInstitucion(item.nueva_institucion_nombre.trim());
              if (result.status === "success" && result.data?.id) {
                processed = { ...processed, institucion_id: result.data.id, nueva_institucion_nombre: undefined };
              }
            }
            return processed;
          }),
        )
      : [];

    const antecedentesProcesados = antecedentes
      ? await Promise.all(
          antecedentes.map(async (item) => {
            let processed = { ...item };
            if (item.organismo_id === -1 && item.nuevo_organismo_nombre?.trim()) {
              const result = await createOrganismoAdscrito(item.nuevo_organismo_nombre.trim());
              if (result.status === "success" && result.data?.id) {
                processed = { ...processed, organismo_id: result.data.id, nuevo_organismo_nombre: undefined };
              } else {
                processed = { ...processed, organismo_id: undefined, nuevo_organismo_nombre: undefined };
              }
            }
            return processed;
          }),
        )
      : [];

    const payloadEmployee = {
      apellidos,
      carnet_patria,
      cedulaidentidad,
      datos_vivienda,
      estadoCivil,
      fecha_nacimiento,
      profile: file?.name ?? null,
      formacion_academica: formacionAcademicaProcesada,
      formacion_complementaria: formacionComplementariaProcesada,
      nombres,
      perfil_fisico,
      perfil_salud,
      sexoid,
      usuario_id: userId,
      antecedentes: antecedentesProcesados,
    };

    const getEmployee = await apiFetch<ApiResponse<never>>(
      "employees_register/",
      {
        method: "POST",
        body: JSON.stringify(payloadEmployee),
      },
    );
    console.log("[formStepActions] payload:", JSON.stringify(payloadEmployee, null, 2));
    console.log("[formStepActions] response:", JSON.stringify(getEmployee, null, 2));

    let nestjsOk = true;
    if (data.file) {
      const formData = new FormData();
      formData.append("file", data.file);
      const responseNestjs = await fetch(
        `${process.env.NEXT_PUBLIC_NEST_API_URL_SERVER}file-save/upload/profile/${data.cedulaidentidad}`,
        {
          method: "POST",
          body: formData,
        },
      );
      nestjsOk = responseNestjs.ok;
    }

    return {
      success: getEmployee.status === "success",
      message: getEmployee.message || "Error al registrar empleado",
    };
  } catch {
    return {
      success: false,
      message: "Ocurrio Un Error ",
    };
  }
}
