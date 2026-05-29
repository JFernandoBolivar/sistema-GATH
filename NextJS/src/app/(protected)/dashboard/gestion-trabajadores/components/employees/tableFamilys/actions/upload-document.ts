"use server";

import { cookies } from "next/headers";

export async function uploadFamilyDocument(formData: FormData) {
  const familiarId = formData.get("familiarId") as string;
  const documentType = formData.get("document_type") as string;
  const file = formData.get("file") as File;

  if (!familiarId || !documentType || !file) {
    return { success: false, message: "Datos incompletos: falta familiarId, document_type o file" };
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("dj_access")?.value;

  const uploadFormData = new FormData();
  uploadFormData.append("document_type", documentType);
  uploadFormData.append("file", file);

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}Employeefamily/${familiarId}/documentos/`,
      {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        body: uploadFormData,
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Error desconocido" }));
      return { success: false, message: err.message || err.detail || "Error al subir documento" };
    }

    const data = await res.json();
    return { success: data.status === "Ok", message: data.message };
  } catch (e: any) {
    return { success: false, message: e.message || "Error de conexion" };
  }
}
