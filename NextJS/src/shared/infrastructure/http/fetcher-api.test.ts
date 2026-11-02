import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * MSW no está instalado en NextJS/package.json (F1.5c solo trajo Vitest + RTL);
 * se mockea `fetch` y las dependencias de servidor (`next/headers`, `#/auth`,
 * `@/lib/api-client`) directamente. Cubre el contrato de F2.10: 200, 401 con
 * refresco exitoso, 403 y 500 (ALTA-01: ya no se hace `response.json()` a ciegas).
 */

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === "dj_access" ? { value: "token-actual" } : undefined),
  })),
}));

vi.mock("#/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "1" } })),
}));

vi.mock("@/lib/api-client", () => ({
  refreshTokens: vi.fn(async () => "token-refrescado"),
}));

const { apiClient } = await import("./fetcher-api");

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiClient (fetcher-api)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve el envelope C-1 en una respuesta 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ status: "success", message: "ok", data: { id: 1 } }, 200)),
    );

    const result = await apiClient.get<{ status: string; data: { id: number } }>("personal/1/");

    expect(result.data.id).toBe(1);
  });

  it("reintenta una sola vez tras un 401 usando el token refrescado", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ status: "success", message: "ok", data: [] }, 200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiClient.get("personal/");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCallHeaders = fetchMock.mock.calls[1][1].headers as Record<string, string>;
    expect(secondCallHeaders.Authorization).toBe("Bearer token-refrescado");
    expect(result).toEqual({ status: "success", message: "ok", data: [] });
  });

  it("lanza un error legible ante un 403 (sin exponer el cuerpo crudo)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 403 })));

    await expect(apiClient.get("roles/")).rejects.toThrow("No tienes permiso");
  });

  it("lanza error con el mensaje del servidor ante un 500 (ALTA-11/S6: sin traceback)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ status: "error", message: "Fallo interno del servidor" }, 500)),
    );

    await expect(apiClient.get("reportes/")).rejects.toThrow("Fallo interno del servidor");
  });

  it("propaga X-Trace-Id en cada petición (C-5)", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ status: "success", message: "ok", data: null }, 200),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiClient.get("personal/", { traceId: "trace-fijo-123" });

    const init = fetchMock.mock.calls[0]?.[1];
    const headers = ((init?.headers ?? {}) as Record<string, string>);
    expect(headers["X-Trace-Id"]).toBe("trace-fijo-123");
  });

  it("construye el query string a partir de `options.params` (Fase 1: bug antes silente, params nunca llegaba al backend)", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ status: "success", message: "ok", data: [] }, 200),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiClient.get("personal/", { params: { q: "garcía", pagina: 2, activo: true, vacio: undefined } });

    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain("personal/?");
    expect(url).toContain("q=garc%C3%ADa");
    expect(url).toContain("pagina=2");
    expect(url).toContain("activo=true");
    expect(url).not.toContain("vacio");
  });

  it("no agrega '?' cuando `params` está vacío o ausente", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ status: "success", message: "ok", data: [] }, 200),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiClient.get("personal/", { params: {} });

    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).not.toContain("?");
  });

  it("permite peticiones públicas sin cabecera de Authorization cuando skipAuth es true", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ status: "success", message: "ok", data: null }, 200),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiClient.post("identidad/auth/solicitar-recuperacion/", { identificador: "test@conatel.gob.ve" }, { skipAuth: true });

    const init = fetchMock.mock.calls[0]?.[1];
    const headers = ((init?.headers ?? {}) as Record<string, string>);
    expect(headers["Authorization"]).toBeUndefined();
    expect(headers["X-Trace-Id"]).toBeDefined();
  });
});
