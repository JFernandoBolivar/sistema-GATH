"use server";

import { auth } from "#/auth";
import { submitCensoVivienda } from "../api/getInfoAutogestion";

interface RespuestaItem {
  pregunta: number;
  opcion: number | null;
  respuesta: string;
}

interface ViviendaData {
  direccion_exacta?: string;
  estado_id?: number;
  municipio_id?: number;
  parroquia?: number;
  condicion_vivienda_id?: number;
  codigo_postal?: string;
}

interface ActionResponse {
  success: boolean;
  message: string;
}

export async function getSessionCedula(): Promise<string | null> {
  const session = await auth();
  return session?.user?.cedula ?? null;
}

export async function enviarAutogestion(
  carnetPatria: string,
  datosVivienda: ViviendaData | undefined,
  respuestas: RespuestaItem[],
): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session || !session.user?.cedula) {
      return {
        success: false,
        message: "No tienes permiso para realizar esta acción. Inicia sesión.",
      };
    }

    const cedula = session.user.cedula;

    const response = await submitCensoVivienda(cedula, {
      carnet_patria: carnetPatria,
      datos_vivienda: datosVivienda || {},
      respuestas,
    });

    return {
      success: response.status === "success",
      message: response.message,
    };
  } catch {
    return {
      success: false,
      message: "Ocurrió un error al enviar el formulario.",
    };
  }
}
