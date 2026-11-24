import { NextResponse, type NextRequest } from "next/server";
import { reenviarFotoPostulante } from "@/modules/postulacion/infrastructure/http/postulacion-api";
import { leerSesionPostulante } from "@/modules/postulacion/infrastructure/sesion-postulante";

/**
 * Foto de carnet del propio postulante (Ventana 2). El navegador habla con este Route Handler del mismo origen
 * y el token de Django, que vive solo en la cookie cifrada, se agrega aquí: nunca llega al navegador. La subida
 * es por `XMLHttpRequest` desde el formulario para poder mostrar el progreso real.
 */
export const dynamic = "force-dynamic";

const SIN_SESION = () =>
  NextResponse.json({ status: "error", message: "Tu sesión terminó. Ingresa de nuevo." }, { status: 401 });

export async function GET(): Promise<Response> {
  const sesion = await leerSesionPostulante();
  if (!sesion) return SIN_SESION();
  let origen: Response;
  try {
    origen = await reenviarFotoPostulante(sesion.tokenDjango, "GET");
  } catch {
    return NextResponse.json({ status: "error", message: "Servicio no disponible." }, { status: 502 });
  }
  const cabeceras = new Headers({ "cache-control": "private, no-store", "x-content-type-options": "nosniff" });
  const tipo = origen.headers.get("content-type");
  if (tipo) cabeceras.set("content-type", tipo);
  return new Response(origen.body, { status: origen.status, headers: cabeceras });
}

export async function POST(req: NextRequest): Promise<Response> {
  const sesion = await leerSesionPostulante();
  if (!sesion) return SIN_SESION();
  let foto: FormDataEntryValue | null = null;
  try {
    foto = (await req.formData()).get("foto");
  } catch {
    foto = null;
  }
  if (!(foto instanceof File) || foto.size === 0) {
    return NextResponse.json({ status: "error", message: "Elige una foto para subir." }, { status: 400 });
  }
  const formulario = new FormData();
  formulario.set("foto", foto, foto.name);
  let origen: Response;
  try {
    origen = await reenviarFotoPostulante(sesion.tokenDjango, "POST", formulario);
  } catch {
    return NextResponse.json({ status: "error", message: "Servicio no disponible." }, { status: 502 });
  }
  return new Response(await origen.text(), {
    status: origen.status,
    headers: { "content-type": origen.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
  });
}
