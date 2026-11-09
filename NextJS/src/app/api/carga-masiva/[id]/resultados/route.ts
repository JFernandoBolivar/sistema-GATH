import { NextRequest, NextResponse } from "next/server";
import { apiFetchBlob } from "@/lib/api-client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const blob = await apiFetchBlob(`/api/v1/carga-masiva/cargas/${id}/resultados/`);

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="resultados-${id}.xlsx"`,
      },
    });
  } catch (error: unknown) {
    const mensaje =
      error instanceof Error ? error.message : "Error al descargar los resultados";
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
