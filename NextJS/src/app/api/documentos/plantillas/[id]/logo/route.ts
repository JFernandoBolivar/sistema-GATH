import type { NextRequest } from "next/server";
import { subirArchivoPlantilla } from "@/modules/documentos/infrastructure/http/subir-archivo";

/** Subida multipart del logo de la plantilla (campo «archivo»). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return subirArchivoPlantilla(request, id, "logo");
}
