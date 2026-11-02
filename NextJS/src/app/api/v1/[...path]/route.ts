import { NextRequest, NextResponse } from "next/server";

import { DJANGO_API_SERVER } from "@/shared/commons/api";

/**
 * Proxy de lectura en tiempo de ejecución para archivos que el backend sirve
 * con streaming autenticado (logos de configuración visual, fotos de personal,
 * documentos de familiares, de punto de cuenta y soportes de autogestión). El navegador nunca recibe
 * URLs del almacén de objetos: pide estas rutas al mismo origen y este handler
 * las reenvía a Django con la cookie `dj_access` como `Authorization: Bearer`
 * (`CookieJWTAuthentication` acepta ambos). Solo GET y solo prefijos de la
 * lista blanca: no es un proxy genérico del backend.
 */
const RUTAS_PERMITIDAS: readonly RegExp[] = [
  /^configuracion\/visual\/logo\/(logo-principal|logo-secundario|cintillo-pie)\/?$/,
  /^personal\/[^/]+\/foto\/?$/,
  /^familiares\/[^/]+\/documentos\/[^/]+\/archivo\/?$/,
  /^carnetizacion\/plantillas\/\d+\/imagen\/?$/,
  /^puntocuenta\/[^/]+\/documento\/archivo\/?$/,
  // Soportes de las solicitudes de actualización de datos (Django valida dueño o Bienestar).
  /^autogestion\/soportes\/[0-9a-f-]{36}\/archivo\/?$/,
];

// Cabeceras de la respuesta original que se propagan al navegador.
const CABECERAS_RESPUESTA = [
  "content-type",
  "content-length",
  "content-disposition",
  "cache-control",
  "etag",
  "last-modified",
] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  const ruta = path.join("/");

  // Rechaza traversal y segmentos vacíos antes de comparar con la lista blanca.
  if (path.some((s) => s === "" || s === "." || s === "..")) {
    return NextResponse.json({ detail: "Ruta no permitida." }, { status: 404 });
  }
  if (!RUTAS_PERMITIDAS.some((re) => re.test(ruta))) {
    return NextResponse.json({ detail: "Ruta no permitida." }, { status: 404 });
  }

  const token = req.cookies.get("dj_access")?.value;
  if (!token) {
    return NextResponse.json({ detail: "No autenticado." }, { status: 401 });
  }

  const destino = `${DJANGO_API_SERVER}api/v1/${path.map(encodeURIComponent).join("/")}${
    path.length ? "/" : ""
  }${req.nextUrl.search}`;

  let upstream: Response;
  try {
    upstream = await fetch(destino, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return NextResponse.json({ detail: "Servicio no disponible." }, { status: 502 });
  }

  const headers = new Headers();
  for (const nombre of CABECERAS_RESPUESTA) {
    const valor = upstream.headers.get(nombre);
    if (valor) headers.set(nombre, valor);
  }
  // Recurso autenticado: nunca cacheable por intermediarios compartidos.
  if (!headers.has("cache-control")) headers.set("cache-control", "private, no-store");

  return new Response(upstream.body, { status: upstream.status, headers });
}
