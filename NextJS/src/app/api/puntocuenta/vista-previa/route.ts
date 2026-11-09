import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const blob = await apiClient.postBlob("/api/v1/puntocuenta/configuracion/vista-previa/", body);
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="vista_previa_punto_cuenta.pdf"',
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al generar la vista previa" },
      { status: 500 }
    );
  }
}
