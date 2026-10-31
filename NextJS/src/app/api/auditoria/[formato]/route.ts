import { NextRequest, NextResponse } from "next/server";

import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { ApiHttpError, SessionExpiredError } from "@/shared/infrastructure/http/errors";

/**
 * Descarga de la bitácora (D10). El navegador pide al mismo origen; este handler
 * reenvía los filtros a Django con la sesión y devuelve el archivo y las
 * cabeceras X-Reporte-* de truncado. Mismo patrón que `/api/reports/pdf`.
 */
const RUTA_POR_FORMATO: Record<string, string> = {
  pdf: "/api/v1/auditoria/pdf/",
  excel: "/api/v1/auditoria/excel/",
};

const TIPO_CONTENIDO: Record<string, string> = {
  pdf: "application/pdf",
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const EXTENSION: Record<string, string> = { pdf: "pdf", excel: "xlsx" };

const FILTROS_PERMITIDOS = [
  "usuario",
  "accion",
  "modulo",
  "recurso",
  "ip",
  "desde",
  "hasta",
  "resultado",
] as const;

const CABECERAS_DE_METADATOS = [
  "x-reporte-total-registros",
  "x-reporte-limite",
  "x-reporte-truncado",
] as const;

const MENSAJE_GENERICO = "No fue posible generar el documento de la bitácora.";
const MENSAJE_SESION_EXPIRADA = "La sesión expiró. Vuelva a iniciar sesión.";

function filtrosDe(request: NextRequest): Record<string, string> {
  const params: Record<string, string> = {};
  for (const nombre of FILTROS_PERMITIDOS) {
    const valor = request.nextUrl.searchParams.get(nombre);
    if (valor !== null && valor.trim() !== "") params[nombre] = valor.trim();
  }
  return params;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formato: string }> },
): Promise<Response> {
  const { formato } = await params;
  const ruta = RUTA_POR_FORMATO[formato];
  if (!ruta) {
    return NextResponse.json(
      { error: `Formato no válido: «${formato}». Válidos: pdf, excel.` },
      { status: 400 },
    );
  }

  try {
    const { blob, headers: origen } = await apiClient.getBlobConRespuesta(ruta, {
      params: filtrosDe(request),
    });
    const cuerpo = await blob.arrayBuffer();

    const headers = new Headers({
      "Content-Type": TIPO_CONTENIDO[formato],
      "Content-Disposition": `attachment; filename="bitacora-auditoria.${EXTENSION[formato]}"`,
      "Cache-Control": "private, no-store",
    });
    for (const nombre of CABECERAS_DE_METADATOS) {
      const valor = origen.get(nombre);
      if (valor) headers.set(nombre, valor);
    }

    return new NextResponse(cuerpo, { status: 200, headers });
  } catch (error) {
    console.error("Error al descargar la bitácora:", error);
    if (error instanceof SessionExpiredError) {
      return NextResponse.json({ error: MENSAJE_SESION_EXPIRADA }, { status: 401 });
    }
    const status = error instanceof ApiHttpError ? error.status : 500;
    const mensaje = error instanceof ApiHttpError ? error.message : MENSAJE_GENERICO;
    return NextResponse.json({ error: mensaje }, { status });
  }
}
