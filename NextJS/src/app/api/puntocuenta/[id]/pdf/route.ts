import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const blob = await apiClient.getBlob(`/api/v1/puntocuenta/${id}/documento/archivo/`);
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="punto_cuenta_${id}.pdf"`,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al descargar el punto de cuenta" },
      { status: 500 }
    );
  }
}
