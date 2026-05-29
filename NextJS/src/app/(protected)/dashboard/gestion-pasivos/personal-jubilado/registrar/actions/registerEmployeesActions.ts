"use server";
import { apiFetch } from "@/lib/api-client";
import { ApiResponse } from "@/app/types/types";
import z from "zod";
import { schemaRac } from "../schemas/schemaRac";

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
      profile: file?.name,
    };

    const message = await apiFetch<ApiResponse<string>>(
      `employees_register/`,
      {
        method: "POST",
        body: JSON.stringify({ ...payload, usuario_id: user_id }),
      },
    );
    if (message.status !== "success") {
      return {
        success: false,
        message: message.message,
      };
    }
    const formData = new FormData();
    formData.append("file", values.file!);
    await fetch(
      `${process.env.NEXT_PUBLIC_NEST_API_URL_SERVER}file-save/upload/profile/${values.cedulaidentidad}`,

      {
        method: "POST",
        body: formData,
      },
    );
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
