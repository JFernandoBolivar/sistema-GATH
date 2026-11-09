import { NextRequest, NextResponse } from "next/server";

import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { ApiHttpError, SessionExpiredError } from "@/shared/infrastructure/http/errors";

/**
 * Descarga del archivo de una exportación lista. Django valida que quien pide el
 * archivo es quien lo solicitó; aquí se reenvían el contenido y las cabeceras
 * `X-Reporte-*` de truncado. El navegador nunca recibe una URL del almacén.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CABECERAS_A_PROPAGAR = [
  "content-type",
  "content-disposition",
  "x-reporte-total-registros",
  "x-reporte-limite",
  "x-reporte-truncado",
] as const;
const MENSAJE_GENERICO = "No fue posible descargar el archivo de la exportación.";
const MENSAJE_SESION_EXPIRADA = "La sesión expiró. Vuelva a iniciar sesión.";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Identificador de exportación no válido." }, { status: 400 });
  }
  try {
    const { blob, headers: origen } = await apiClient.getBlobConRespuesta(
      `/api/v1/exportaciones/${id}/descargar/`,
    );
    const headers = new Headers({ "Cache-Control": "private, no-store" });
    for (const nombre of CABECERAS_A_PROPAGAR) {
      const valor = origen.get(nombre);
      if (valor) headers.set(nombre, valor);
    }
    return new NextResponse(await blob.arrayBuffer(), { status: 200, headers });
  } catch (error) {
    console.error("Error al descargar una exportación:", error);
    if (error instanceof SessionExpiredError) {
      return NextResponse.json({ error: MENSAJE_SESION_EXPIRADA }, { status: 401 });
    }
    const status = error instanceof ApiHttpError ? error.status : 500;
    const mensaje = error instanceof ApiHttpError ? error.message : MENSAJE_GENERICO;
    return NextResponse.json({ error: mensaje }, { status });
  }
}
