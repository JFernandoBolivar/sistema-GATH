import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { categoria, filtros } = body;

    let path = "/api/v1/reportes/personal-activo/pdf/";
    if (categoria === "familiares") {
      path = "/api/v1/reportes/familiares/pdf/";
    } else if (categoria === "egresados") {
      path = "/api/v1/reportes/pasivos/pdf/";
    } else if (categoria === "asignaciones" || categoria === "codigos") {
      path = "/api/v1/reportes/codigos/pdf/";
    } else if (categoria === "distribucion") {
      path = "/api/v1/reportes/distribucion-nomina/pdf/";
    }

    // Limpiar y aplanar filtros para query params
    const params: Record<string, string | number | boolean> = {};
    if (filtros && typeof filtros === "object") {
      for (const [key, val] of Object.entries(filtros)) {
        if (val !== undefined && val !== null && val !== "") {
          if (val instanceof Date || (typeof val === "string" && !isNaN(Date.parse(val)) && val.includes("T"))) {
            params[key] = new Date(val as string).toISOString().split("T")[0];
          } else {
            params[key] = val as string | number | boolean;
          }
        }
      }
    }

    const blob = await apiClient.getBlob(path, { params });
    const arrayBuffer = await blob.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="reporte_${categoria || "general"}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error al generar PDF de reporte:", error);
    return NextResponse.json(
      { error: "No fue posible generar el archivo PDF del reporte." },
      { status: 500 },
    );
  }
}
