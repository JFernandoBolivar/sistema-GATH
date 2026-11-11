import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { estadoDeError, mensajeDeError } from "@/shared/infrastructure/http/respuesta-error";
import type { ApiResponse } from "@/shared/types/api-response";
import type { CargaMasivaResumen } from "@/modules/carga-masiva/domain/entities/carga-masiva";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const resultado = await apiClient.postForm<ApiResponse<CargaMasivaResumen>>(
      "/api/v1/carga-masiva/cargas/",
      formData,
    );

    return NextResponse.json(
      {
        ok: true,
        status: resultado.status ?? "success",
        data: resultado.data ?? resultado,
        message: resultado.message,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    // F2-06: se conserva el código del backend (400 por archivo inválido, 401/403
    // por sesión/permiso) en vez de convertirlo siempre en 500.
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        message: mensajeDeError(error, "Error al procesar el archivo"),
      },
      { status: estadoDeError(error) },
    );
  }
}
