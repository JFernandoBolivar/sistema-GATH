"use server";
import { auth } from "#/auth";
import {
  createPrestamoCargoFn,
  createMotivoEncargaduria,
  updatePrestamoCargoFn,
} from "../../api/getInfoRac";
import { PrestamoCargoFormType } from "./schema";

export async function createPrestamoCargoAction(data: PrestamoCargoFormType) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: "No autorizado" };
    }

    let motivoId = data.motivo;
    if (data.motivo === -1 && data.nueva_motivo_nombre?.trim()) {
      const result = await createMotivoEncargaduria(data.nueva_motivo_nombre.trim());
      if (result.status === "success" && result.data?.id) {
        motivoId = result.data.id;
      } else {
        return { success: false, message: result.message || "Error al crear el motivo" };
      }
    }

    const payload = {
      empleado_encargado: data.empleado_encargado,
      cargo_encargado: data.cargo_encargado,
      motivo: motivoId,
      fecha_inicio: data.fecha_inicio.toISOString().split("T")[0],
      fecha_fin: data.fecha_fin.toISOString().split("T")[0],
      ejecutado_por: Number(session.user.id),
    };

    const response = await createPrestamoCargoFn(payload);
    return {
      success: response.status === "success",
      message: response.message,
    };
  } catch {
    return { success: false, message: "Ocurrio un error" };
  }
}

export async function finalizarPrestamoCargoAction(id: number, fecha_fin: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: "No autorizado" };
    }

    const response = await updatePrestamoCargoFn(id, { fecha_fin });
    return {
      success: response.status === "success",
      message: response.message,
    };
  } catch {
    return { success: false, message: "Ocurrio un error" };
  }
}
