import { NextResponse, type NextRequest } from "next/server";
import { reenviarDocumentoPostulante } from "@/modules/postulacion/infrastructure/http/postulacion-api";
import { leerSesionPostulante } from "@/modules/postulacion/infrastructure/sesion-postulante";

/**
 * PDF de un documento del propio postulante (Ventana 2): `?tipo=vista-previa` (su planilla prellenada, por defecto) o
 * `?tipo=archivo` (la firmada). El navegador habla con este Route Handler del mismo origen; el token de Django vive solo en
 * la cookie cifrada y se agrega aquí. El código es el de la plantilla, nunca un id ajeno: el expediente sale de la sesión.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }): Promise<Response> {
  const { codigo } = await params;
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(codigo)) {
    return NextResponse.json({ status: "error", message: "Documento no válido." }, { status: 400 });
  }
  const sesion = await leerSesionPostulante();
  if (!sesion) {
    return NextResponse.json({ status: "error", message: "Tu sesión terminó. Ingresa de nuevo." }, { status: 401 });
  }
  const tipo = req.nextUrl.searchParams.get("tipo") === "archivo" ? "archivo" : "vista-previa";
  let origen: Response;
  try {
    origen = await reenviarDocumentoPostulante(sesion.tokenDjango, codigo, tipo);
  } catch {
    return NextResponse.json({ status: "error", message: "Servicio no disponible." }, { status: 502 });
  }
  const cabeceras = new Headers({ "cache-control": "private, no-store", "x-content-type-options": "nosniff" });
  const contenido = origen.headers.get("content-type");
  if (contenido) cabeceras.set("content-type", contenido);
  if (origen.ok) cabeceras.set("content-disposition", `inline; filename="${codigo}.pdf"`);
  return new Response(origen.body, { status: origen.status, headers: cabeceras });
}
