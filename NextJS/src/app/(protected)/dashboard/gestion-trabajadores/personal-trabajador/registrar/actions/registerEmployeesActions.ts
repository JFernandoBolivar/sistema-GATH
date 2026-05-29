"use server";
import { ApiResponse } from "@/app/types/types";
import z from "zod";
import { schemaRac } from "../schemas/schemaRac";
import { apiFetch } from "@/lib/api-client";

export async function registerEmployee(
  values: z.infer<typeof schemaRac>,
  user_id: string,
) {
  try {
    const {
      file,
      fecha_nacimiento,
      fechaingresoapn,
      ...data
    } = values;
    const payload = {
      ...data,
      fecha_nacimiento: fecha_nacimiento.toISOString(),
      fechaingresoapn: fechaingresoapn.toISOString(),
      contrato: data.contrato
        ? [
            {
              n_contrato: data.contrato.n_contrato,
              fecha_ingreso: data.contrato.fecha_ingreso,
              politica_id: data.contrato.politica_id,
              fecha_culminacion: data.contrato.fecha_culminacion ?? null,
            },
          ]
        : [],
      profile: file?.name,
    };

    const message = await apiFetch<ApiResponse<string>>(
      "employees_register/",
      {
        method: "POST",
        body: JSON.stringify({ ...payload, usuario_id: user_id }),
      },
    );
    console.log("[registerEmployee] payload:", JSON.stringify({ ...payload, usuario_id: user_id }, null, 2));
    console.log("[registerEmployee] response:", JSON.stringify(message, null, 2));
    if (message.status !== "success") {
      return {
        success: false,
        message: message.message,
      };
    }
    if (values.file) {
      const formData = new FormData();
      formData.append("file", values.file);
      await fetch(
        `${process.env.NEXT_PUBLIC_NEST_API_URL_SERVER}file-save/upload/profile/${values.cedulaidentidad}`,
        {
          method: "POST",
          body: formData,
        },
      );
    }
    return {
      success: true,
      message: message.message,
    };
  } catch {
    return {
      success: false,
      message: "Ocurrio un error",
    };
  }
}
