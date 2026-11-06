import { NextRequest, NextResponse } from "next/server";

import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { ApiHttpError, SessionExpiredError } from "@/shared/infrastructure/http/errors";

/**
 * Proxy de exportación asíncrona (PDF/Excel) de las estadísticas de fe de vida.
 *
 * Django valida los filtros y responde 202 con el trabajo; el navegador consulta
 * su estado en `/api/exportaciones/{id}` y descarga solo si es el solicitante.
 */
const RUTA = "/api/v1/fe-de-vida/estadisticas/exportar/";
const MENSAJE = "No se pudo solicitar la exportación de las estadísticas.";

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
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "private, no-store",
      },
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

/** Igual que el GET, pero con los PNG de los gráficos capturados en la pantalla. */
export async function POST(req: NextRequest) {
  try {
    const params: Record<string, string> = {};
    req.nextUrl.searchParams.forEach((valor, clave) => {
      if (valor !== "") params[clave] = valor;
    });
    const cuerpo = (await req.json().catch(() => ({}))) as { imagenes?: unknown };
    const envelope = await apiClient.post<unknown>(
      RUTA,
      { imagenes: Array.isArray(cuerpo.imagenes) ? cuerpo.imagenes : [] },
      { params },
    );
    return NextResponse.json(envelope, {
      status: 202,
      headers: { "Cache-Control": "private, no-store" },
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
