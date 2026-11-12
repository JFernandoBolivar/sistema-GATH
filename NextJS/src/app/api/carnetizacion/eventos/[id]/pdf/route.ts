import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";

/** Gafetes del evento en PDF: se sirve por el mismo origen para poder abrirlo o descargarlo desde el hub. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const blob = await apiClient.getBlob(`/api/v1/carnetizacion/eventos/${encodeURIComponent(id)}/pdf/`);
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="gafetes_evento_${id}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No fue posible generar los gafetes en PDF." },
      { status: 500 }
    );
  }
}
