import { NextRequest, NextResponse } from "next/server";
import { apiFetchFormData } from "@/lib/api-client";
import type { ApiResponse } from "@/shared/types/api-response";
import type { CargaMasivaResumen } from "@/modules/carga-masiva/domain/entities/carga-masiva";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const resultado = await apiFetchFormData<ApiResponse<CargaMasivaResumen>>(
      "/api/v1/carga-masiva/cargas/",
      formData,
      "POST",
    );

    // Respetar contrato C-1 (status: "success") e incluir ok: true para clientes que lo evalúen
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
    const mensaje =
      error instanceof Error ? error.message : "Error al procesar el archivo";
    return NextResponse.json(
      { ok: false, status: "error", message: mensaje, error: mensaje },
      { status: 500 },
    );
  }
}
