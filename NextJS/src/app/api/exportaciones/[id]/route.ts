import { NextRequest, NextResponse } from "next/server";

import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { ApiHttpError, SessionExpiredError } from "@/shared/infrastructure/http/errors";

/**
 * Estado de una exportación asíncrona (pendiente, en proceso con porcentaje,
 * lista, error o expirada). Reenvía a Django con la sesión: solo responde al
 * usuario que pidió la exportación (404 para cualquier otro).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MENSAJE_GENERICO = "No fue posible consultar el estado de la exportación.";
const MENSAJE_SESION_EXPIRADA = "La sesión expiró. Vuelva a iniciar sesión.";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Identificador de exportación no válido." }, { status: 400 });
  }
  try {
    const envelope = await apiClient.get<unknown>(`/api/v1/exportaciones/${id}/`);
    return NextResponse.json(envelope, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return NextResponse.json({ error: MENSAJE_SESION_EXPIRADA }, { status: 401 });
    }
    const status = error instanceof ApiHttpError ? error.status : 500;
    const mensaje = error instanceof ApiHttpError ? error.message : MENSAJE_GENERICO;
    return NextResponse.json({ error: mensaje }, { status });
  }
}
