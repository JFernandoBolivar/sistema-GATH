import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { estadoDeError, mensajeDeError } from "@/shared/infrastructure/http/respuesta-error";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // F2-17: el id se valida antes de llamar a Django.
  if (!UUID.test(id)) {
    return NextResponse.json(
      { ok: false, status: "error", message: "El identificador de la carga no es válido." },
      { status: 400 },
    );
  }
  try {
    const blob = await apiClient.getBlob(`/api/v1/carga-masiva/cargas/${id}/resultados/`);

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="resultados-${id}.xlsx"`,
      },
    });
  } catch (error: unknown) {
    // F2-06: un 403/404 del backend se entrega como error, no como archivo.
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        message: mensajeDeError(error, "Error al descargar los resultados"),
      },
      { status: estadoDeError(error) },
    );
  }
}
