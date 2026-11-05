import { NextRequest, NextResponse } from "next/server";

import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { ApiHttpError, SessionExpiredError } from "@/shared/infrastructure/http/errors";

/** Proxy de la exportación asíncrona (PDF/Excel) de la bandeja de fe de vida. */
const RUTA = "/api/v1/fe-de-vida/solicitudes/exportar/";
const MENSAJE = "No se pudo solicitar la exportación de la bandeja.";

export async function GET(req: NextRequest) {
  try {
    const params: Record<string, string> = {};
    req.nextUrl.searchParams.forEach((valor, clave) => {
      if (valor !== "") params[clave] = valor;
    });
    const { blob, status } = await apiClient.getBlobConRespuesta(RUTA, { params });
    if (status === 202) {
      return new NextResponse(await blob.arrayBuffer(), {
        status: 202,
        headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
      });
    }
    return new NextResponse(await blob.arrayBuffer(), {
      status,
      headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return NextResponse.json({ error: "La sesión expiró. Vuelva a iniciar sesión." }, { status: 401 });
    }
    const status = error instanceof ApiHttpError ? error.status : 500;
    const mensaje = error instanceof ApiHttpError ? error.message : MENSAJE;
    return NextResponse.json({ error: mensaje }, { status });
  }
}
