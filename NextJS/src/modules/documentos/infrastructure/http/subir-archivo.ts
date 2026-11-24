import { NextResponse, type NextRequest } from "next/server";
import { estadoDeError, mensajeDeError } from "@/shared/infrastructure/http/respuesta-error";
import { ApiHttpError } from "@/shared/infrastructure/http/errors";
import { documentosApi } from "./documentos-api";

/** Reenvía al backend la subida multipart del fondo (PDF) o del logo (imagen) de una plantilla. */
export async function subirArchivoPlantilla(request: NextRequest, id: string, recurso: "fondo" | "logo") {
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ ok: false, status: "error", message: "Identificador de plantilla no válido." }, { status: 400 });
  }
  try {
    const formData = await request.formData();
    const r = await documentosApi.subirArchivo(id, recurso, formData);
    return NextResponse.json({ ok: true, status: r.status ?? "success", data: r.data, message: r.message });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        message: mensajeDeError(error, "Error al subir el archivo"),
        errores: error instanceof ApiHttpError ? error.errores : undefined,
      },
      { status: estadoDeError(error) },
    );
  }
}
