import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { estadoDeError, mensajeDeError } from "@/shared/infrastructure/http/respuesta-error";

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const blob = await apiClient.getBlob("/api/v1/carga-masiva/plantilla/", { params });

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
    // F2-06: el error del backend se devuelve como error con su código real,
    // no como un «.xlsx» con el JSON de error dentro.
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        message: mensajeDeError(error, "Error al descargar la plantilla"),
      },
      { status: estadoDeError(error) },
    );
  }
}
