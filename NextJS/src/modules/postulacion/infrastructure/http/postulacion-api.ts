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
    errores?: Record<string, string[]>;
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
    const errores =
      datos?.errores && typeof datos.errores === "object" && !Array.isArray(datos.errores)
        ? datos.errores
        : undefined;
    throw new ErrorPostulacion(
      typeof sobre?.message === "string" && sobre.message
        ? sobre.message
        : "No fue posible completar la operación.",
      respuesta.status,
      datos?.codigo,
      datos?.bloqueada_hasta,
      errores,
    );
  }
  if (!sobre || sobre.data === undefined || sobre.data === null) {
    throw new ErrorPostulacion("Respuesta inesperada del sistema.", respuesta.status);
  }
  return sobre.data as T;
}
