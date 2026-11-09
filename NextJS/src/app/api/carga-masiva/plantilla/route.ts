import { NextRequest, NextResponse } from "next/server";
import { apiFetchBlob } from "@/lib/api-client";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams.toString();
    const query = searchParams ? `?${searchParams}` : "";
    const blob = await apiFetchBlob(`/api/v1/carga-masiva/plantilla/${query}`);

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="plantilla-carga-masiva.xlsx"',
      },
    });
  } catch (error: unknown) {
    const mensaje =
      error instanceof Error ? error.message : "Error al descargar la plantilla";
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
