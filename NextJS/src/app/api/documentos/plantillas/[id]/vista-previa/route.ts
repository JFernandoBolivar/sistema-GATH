import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { estadoDeError, mensajeDeError } from "@/shared/infrastructure/http/respuesta-error";

/** Vista previa en PDF del borrador (también de lo no guardado, enviado en el cuerpo). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: "Identificador de plantilla no válido." }, { status: 400 });
  }
  try {
    const cuerpo = await request.json().catch(() => ({}));
    const blob = await apiClient.postBlob(`/api/v1/documentos/plantillas/${id}/vista-previa/`, cuerpo);
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="vista_previa_documento.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: mensajeDeError(error, "Error al generar la vista previa") },
      { status: estadoDeError(error) },
    );
  }
}
