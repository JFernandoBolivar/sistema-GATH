import { cookies } from "next/headers";
import { auth } from "#/auth";
import { refreshTokens } from "@/lib/api-client";
import { DJANGO_API_SERVER } from "@/shared/commons/api";
import { SessionExpiredError } from "./errors";
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";

/**
 * Cliente HTTP canónico del kernel compartido (F2.10). Reemplaza gradualmente a
 * `@/lib/api-client.ts`: delega en él únicamente `refreshTokens()` (rotación de
 * `dj_access`/`dj_refresh` vía cookies httpOnly) para no duplicar esa lógica mientras
 * dura la migración, pero corrige su falla de origen — ALTA-01: el legado devolvía
 * `response.json()` para cualquier status distinto de 401, incluyendo 403/404/500.
 * Aquí toda respuesta pasa por `response.ok` antes de intentar parsear el cuerpo.
 *
 * Además inyecta `X-Trace-Id` en cada petición (C-5) para correlacionar con
 * `logs/frontend/audit_frontend.txt` y `logs/backend/audit_backend.txt`.
 */

export interface RequestOptions {
  headers?: Record<string, string>;
  traceId?: string;
  /**
   * Parámetros de query string. Bug corregido en la Fase 1 del plan de
   * reparación: este campo existía en las llamadas de varios módulos
   * (`cargos-api.ts`, `catalogos-api.ts`, `organizacion-api.ts`,
   * `reportes-api.ts`, `personal-api.ts`...) pero `RequestOptions` nunca lo
   * declaró ni `request()` lo usaba — el query string jamás se construía, así
   * que los filtros de búsqueda nunca llegaban al backend.
   */
  params?: Record<string, string | number | boolean | undefined | null>;
}

function construirRuta(path: string, params?: RequestOptions["params"]): string {
  if (!params) return path;
  const entradas = Object.entries(params).filter(
    ([, valor]) => valor !== undefined && valor !== null && valor !== "",
  );
  if (entradas.length === 0) return path;
  const queryString = new URLSearchParams(
    entradas.map(([clave, valor]) => [clave, String(valor)]),
  ).toString();
  return path.includes("?") ? `${path}&${queryString}` : `${path}?${queryString}`;
}

async function getAccessToken(): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return null;

  const cookieStore = await cookies();
  const existing = cookieStore.get("dj_access")?.value;
  if (existing) return existing;

  return refreshTokens();
}

async function buildHeaders(
  extra: Record<string, string> | undefined,
  traceId: string,
  isForm: boolean,
): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (!token) throw new SessionExpiredError();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "X-Trace-Id": traceId,
    ...extra,
  };
  if (!isForm) headers["Content-Type"] = "application/json";
  return headers;
}

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body?.message === "string" && body.message.trim().length > 0) {
      return body.message;
    }
  } catch {
    // Respuesta sin cuerpo JSON: se usa el mensaje de reserva.
  }
  return fallback;
}

async function doFetch(
  path: string,
  init: RequestInit,
  headers: Record<string, string>,
): Promise<Response> {
  return fetch(`${DJANGO_API_SERVER}${path}`, { ...init, headers, cache: "no-store" });
}

async function request<T>(
  path: string,
  init: RequestInit,
  options: RequestOptions = {},
  isForm = false,
): Promise<T> {
  const traceId = options.traceId ?? generateTraceId();
  let headers = await buildHeaders(options.headers, traceId, isForm);
  let response = await doFetch(path, init, headers);

  if (response.status === 401) {
    const newToken = await refreshTokens();
    if (!newToken) throw new SessionExpiredError();
    headers = { ...headers, Authorization: `Bearer ${newToken}` };
    response = await doFetch(path, init, headers);
  }

  if (response.status === 403) {
    throw new Error("No tienes permiso para ejecutar esta acción");
  }

  if (!response.ok) {
    const message = await extractErrorMessage(
      response,
      `Error ${response.status} al comunicarse con el servidor`,
    );
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const traceId = options.traceId ?? generateTraceId();
  const headers = await buildHeaders(options.headers, traceId, true);
  delete headers["Content-Type"];

  let response = await doFetch(path, { method: "GET" }, headers);

  if (response.status === 401) {
    const newToken = await refreshTokens();
    if (!newToken) throw new SessionExpiredError();
    response = await doFetch(path, { method: "GET" }, { ...headers, Authorization: `Bearer ${newToken}` });
  }

  if (response.status === 403) {
    throw new Error("No tienes permiso para ejecutar esta acción");
  }
  if (!response.ok) {
    throw new Error(`Error ${response.status} al descargar el recurso`);
  }

  return response.blob();
}

type JsonBody = Record<string, unknown> | unknown[];

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions): Promise<T> =>
    request<T>(construirRuta(path, options?.params), { method: "GET" }, options),

  post: <T>(path: string, body?: JsonBody, options?: RequestOptions): Promise<T> =>
    request<T>(path, { method: "POST", body: body != null ? JSON.stringify(body) : undefined }, options),

  put: <T>(path: string, body?: JsonBody, options?: RequestOptions): Promise<T> =>
    request<T>(path, { method: "PUT", body: body != null ? JSON.stringify(body) : undefined }, options),

  patch: <T>(path: string, body?: JsonBody, options?: RequestOptions): Promise<T> =>
    request<T>(path, { method: "PATCH", body: body != null ? JSON.stringify(body) : undefined }, options),

  delete: <T>(path: string, options?: RequestOptions): Promise<T> => request<T>(path, { method: "DELETE" }, options),

  postForm: <T>(path: string, formData: FormData, options?: RequestOptions): Promise<T> =>
    request<T>(path, { method: "POST", body: formData }, options, true),

  patchForm: <T>(path: string, formData: FormData, options?: RequestOptions): Promise<T> =>
    request<T>(path, { method: "PATCH", body: formData }, options, true),

  getBlob: (path: string, options?: RequestOptions): Promise<Blob> => requestBlob(path, options),
};
