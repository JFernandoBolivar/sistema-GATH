"use server";

import { auth } from "#/auth";
import { apiFetch, apiFetchFormData } from "@/lib/api-client";

export async function subirPlantilla(nombre: string, imagen: File) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, message: "No tienes permiso para realizar esta acción. Inicia sesión." };
    }
    const formData = new FormData();
    formData.append("nombre", nombre.trim());
    formData.append("imagen", imagen);
    const res = await apiFetchFormData<{ success?: boolean }>("carnetizacion/api/plantillas/crear/", formData);
    if (res) return { success: true as const, message: "Plantilla subida exitosamente" };
    return { success: false as const, message: "Error al subir la plantilla" };
  } catch {
    return { success: false as const, message: "Error al subir la plantilla" };
  }
}

export async function activarPlantilla(id: number) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, message: "No tienes permiso para realizar esta acción. Inicia sesión." };
    }
    const data = await apiFetch<{ success: boolean }>(`carnetizacion/api/plantillas/${id}/activar/`, {
      method: "POST",
    });
    if (data.success) return { success: true as const, message: "Plantilla activada exitosamente" };
    return { success: false as const, message: "Error al activar plantilla" };
  } catch {
    return { success: false as const, message: "Error al activar plantilla" };
  }
}
