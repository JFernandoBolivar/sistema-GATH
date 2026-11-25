import { NextRequest, NextResponse } from "next/server";

import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { estadoDeError, mensajeDeError } from "@/shared/infrastructure/http/respuesta-error";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIN_ALMACENAMIENTO = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

/** Proxy autenticado y streaming del PDF. El navegador nunca recibe una URL de Django. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json(
      { error: "Identificador de documento no válido." },
      { status: 400, headers: SIN_ALMACENAMIENTO },
    );
  }
  try {
    const respuesta = await apiClient.getResponse(`/api/v1/documentos/generados/${id}/archivo/`);
    return new NextResponse(respuesta.body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="documento_${id}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: mensajeDeError(error, "No se pudo descargar el documento.") },
      { status: estadoDeError(error), headers: SIN_ALMACENAMIENTO },
    );
  }
}
