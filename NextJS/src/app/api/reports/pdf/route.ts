import { NextRequest, NextResponse } from "next/server";

import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { ApiHttpError, SessionExpiredError } from "@/shared/infrastructure/http/errors";

/**
 * Proxy de generación de reportes (PDF) hacia Django.
 *
 * - Reenvía TODOS los filtros del formulario y, para el reporte de personal,
 *   también `agrupar_por`/`tipo_reporte`.
 * - No se traga el error: devuelve el mensaje y el estado real del backend
 *   (403 sin `reportes.generar_pdf`, 401 de sesión, 400 de filtro inválido,
 *   5xx) para que la UI pueda mostrarlo.
 * - Propaga las cabeceras `X-Reporte-*` con el aviso de tope de filas.
 */
const RUTA_POR_CATEGORIA: Record<string, string> = {
  empleados: "/api/v1/reportes/personal-activo/pdf/",
  familiares: "/api/v1/reportes/familiares/pdf/",
  egresados: "/api/v1/reportes/pasivos/pdf/",
  asignaciones: "/api/v1/reportes/codigos/pdf/",
  codigos: "/api/v1/reportes/codigos/pdf/",
  distribucion: "/api/v1/reportes/distribucion-nomina/pdf/",
};

const CATEGORIA_POR_DEFECTO = "empleados";

/** Categorías cuyo backend aplica agrupación y tipo de reporte. */
const CATEGORIAS_CON_AGRUPACION = new Set(["empleados"]);

const CABECERAS_DE_METADATOS = [
  "x-reporte-total-registros",
  "x-reporte-limite",
  "x-reporte-truncado",
] as const;

const MENSAJE_GENERICO = "No fue posible generar el archivo PDF del reporte.";
const MENSAJE_SESION_EXPIRADA = "La sesión expiró. Vuelva a iniciar sesión.";

function aplanarFiltros(filtros: unknown): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  if (!filtros || typeof filtros !== "object") return params;

  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === "") continue;
    if (valor instanceof Date) {
      params[clave] = valor.toISOString().split("T")[0];
      continue;
    }
    if (typeof valor === "string" && valor.includes("T") && !Number.isNaN(Date.parse(valor))) {
      params[clave] = new Date(valor).toISOString().split("T")[0];
      continue;
    }
    if (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean") {
      params[clave] = valor;
    }
  }
  return params;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      categoria?: string;
      filtros?: unknown;
      agrupar_por?: string;
      tipo_reporte?: string;
    };

    const categoria = body.categoria ?? CATEGORIA_POR_DEFECTO;
    const path = RUTA_POR_CATEGORIA[categoria];
    if (!path) {
      // Una categoría desconocida no debe caer en el reporte de personal.
      return NextResponse.json(
        {
          error: `Categoría de reporte no válida: «${categoria}». Válidas: ${Object.keys(
            RUTA_POR_CATEGORIA,
          ).join(", ")}.`,
        },
        { status: 400 },
      );
    }

    const params = aplanarFiltros(body.filtros);
    if (CATEGORIAS_CON_AGRUPACION.has(categoria)) {
      if (body.agrupar_por) params.agrupar_por = body.agrupar_por;
      if (body.tipo_reporte) params.tipo_reporte = body.tipo_reporte;
    }

    const { blob, headers: origen } = await apiClient.getBlobConRespuesta(path, { params });
    const arrayBuffer = await blob.arrayBuffer();

    const headers = new Headers({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="reporte_${categoria}.pdf"`,
      "Cache-Control": "private, no-store",
    });
    for (const nombre of CABECERAS_DE_METADATOS) {
      const valor = origen.get(nombre);
      if (valor) headers.set(nombre, valor);
    }

    return new NextResponse(arrayBuffer, { status: 200, headers });
  } catch (error) {
    console.error("Error al generar PDF de reporte:", error);
    if (error instanceof SessionExpiredError) {
      return NextResponse.json({ error: MENSAJE_SESION_EXPIRADA }, { status: 401 });
    }
    const status = error instanceof ApiHttpError ? error.status : 500;
    const mensaje = error instanceof ApiHttpError ? error.message : MENSAJE_GENERICO;
    return NextResponse.json({ error: mensaje }, { status });
  }
}
