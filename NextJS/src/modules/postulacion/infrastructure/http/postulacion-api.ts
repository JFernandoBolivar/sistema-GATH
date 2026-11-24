/**
 * Cliente HTTP del backend de postulación (`/api/v1/postulacion/`).
 *
 * NO usa `apiClient`: el token del postulante va SOLO por `Authorization: Bearer`, no por las cookies
 * `dj_access`/`dj_refresh` del personal. Solo se importa desde código de servidor (acciones, páginas).
 */
import { DJANGO_API_SERVER } from "@/shared/commons/api";
import { ipDelCliente } from "@/shared/infrastructure/http/ip-cliente";
import { userAgentDelCliente } from "@/shared/infrastructure/http/user-agent";

const BASE = `${DJANGO_API_SERVER}api/v1/postulacion/`;

export class ErrorPostulacion extends Error {
  constructor(
    mensaje: string,
    readonly status: number,
    readonly codigo?: string,
    readonly bloqueadaHasta?: string,
    readonly errores?: Record<string, string[]>,
    /** Lo que falta para enviar la Ventana 2 (`VENTANA2_INCOMPLETA`). */
    readonly faltantes?: Array<{ seccion: string; campo: string; mensaje: string }>,
  ) {
    super(mensaje);
    this.name = "ErrorPostulacion";
  }
}

interface Sobre<T> {
  status?: string;
  message?: string;
  data?: T & {
    codigo?: string;
    bloqueada_hasta?: string;
    errores?: Record<string, string[] | string>;
    faltantes?: Array<{ seccion: string; campo: string; mensaje: string }>;
  };
}

interface Opciones {
  metodo?: "GET" | "POST" | "PUT";
  token?: string;
  cuerpo?: unknown;
}

export async function llamarPostulacion<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const cabeceras: Record<string, string> = { "Content-Type": "application/json" };
  // Django aplica el throttling por IP: sin esto vería la IP del servidor de Next.
  const ip = await ipDelCliente().catch(() => null);
  if (ip) cabeceras["X-Forwarded-For"] = ip;
  const agente = await userAgentDelCliente().catch(() => null);
  if (agente) cabeceras["User-Agent"] = agente;
  if (opciones.token) cabeceras.Authorization = `Bearer ${opciones.token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      method: opciones.metodo ?? "GET",
      headers: cabeceras,
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
      cache: "no-store",
    });
  } catch {
    throw new ErrorPostulacion("No pudimos conectar con el sistema.", 0, "SERVICIO_NO_DISPONIBLE");
  }

  const sobre = (await respuesta.json().catch(() => null)) as Sobre<T> | null;
  if (!respuesta.ok) {
    const datos = sobre?.data ?? undefined;
    // `data.errores` es `{campo: [mensajes]}` (Ventana 1) o `{ruta: mensaje}` (Ventana 2): se unifica a lista.
    const errores =
      datos?.errores && typeof datos.errores === "object" && !Array.isArray(datos.errores)
        ? Object.fromEntries(
            Object.entries(datos.errores).map(([k, v]) => [k, Array.isArray(v) ? v.map(String) : [String(v)]]),
          )
        : undefined;
    throw new ErrorPostulacion(
      typeof sobre?.message === "string" && sobre.message
        ? sobre.message
        : "No fue posible completar la operación.",
      respuesta.status,
      datos?.codigo,
      datos?.bloqueada_hasta,
      errores,
      Array.isArray(datos?.faltantes) ? datos.faltantes : undefined,
    );
  }
  if (!sobre || sobre.data === undefined || sobre.data === null) {
    throw new ErrorPostulacion("Respuesta inesperada del sistema.", respuesta.status);
  }
  return sobre.data as T;
}

/**
 * Pasa tal cual la respuesta de la foto de carnet del postulante (binario en el GET, sobre JSON en el POST).
 * Solo para el Route Handler `/postulacion/foto`: el token nunca llega al navegador.
 */
export async function reenviarFotoPostulante(token: string, metodo: "GET" | "POST", formulario?: FormData): Promise<Response> {
  const cabeceras: Record<string, string> = { Authorization: `Bearer ${token}` };
  const ip = await ipDelCliente().catch(() => null);
  if (ip) cabeceras["X-Forwarded-For"] = ip;
  return fetch(`${BASE}ventana2/foto/`, { method: metodo, headers: cabeceras, body: formulario, cache: "no-store" });
}

/**
 * Pasa tal cual el PDF de un documento del propio postulante (`vista-previa` = su planilla prellenada; `archivo` = la firmada).
 * Solo para el Route Handler `/postulacion/documento/[codigo]`: el token nunca llega al navegador.
 */
export async function reenviarDocumentoPostulante(token: string, codigo: string, tipo: "vista-previa" | "archivo"): Promise<Response> {
  const cabeceras: Record<string, string> = { Authorization: `Bearer ${token}` };
  const ip = await ipDelCliente().catch(() => null);
  if (ip) cabeceras["X-Forwarded-For"] = ip;
  return fetch(`${BASE}ventana2/documentos/${encodeURIComponent(codigo)}/${tipo}/`, { headers: cabeceras, cache: "no-store" });
}
