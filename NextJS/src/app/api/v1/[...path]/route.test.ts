import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "./route";

function pedir(ruta: string, cookie?: string) {
  const req = new NextRequest(`http://localhost:3001/api/v1/${ruta}`, {
    headers: cookie ? { cookie: `dj_access=${cookie}` } : {},
  });
  return GET(req, {
    params: Promise.resolve({
      path: ruta
        .split("?")[0]
        .split("/")
        .filter((s, i, a) => s !== "" || i < a.length - 1),
    }),
  });
}

describe("proxy /api/v1 (archivos autenticados)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reenvía con Bearer y devuelve cuerpo y cabeceras originales", async () => {
    fetchMock.mockResolvedValue(
      new Response("imgdata", {
        status: 200,
        headers: { "content-type": "image/png", "content-length": "7", "set-cookie": "x=1" },
      }),
    );
    const res = await pedir("personal/123/foto/?v=abc", "tok");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-length")).toBe("7");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.text()).toBe("imgdata");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/api\/v1\/personal\/123\/foto\/\?v=abc$/);
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("permite la imagen de plantillas de carnet", async () => {
    fetchMock.mockResolvedValue(new Response("x", { status: 200 }));
    const res = await pedir("carnetizacion/plantillas/7/imagen/", "tok");
    expect(res.status).toBe(200);
    expect((await pedir("carnetizacion/plantillas/x/imagen/", "tok")).status).toBe(404);
  });

  it("responde 401 sin cookie y no llama al backend", async () => {
    const res = await pedir("personal/123/foto/");
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "personal/123/",
    "usuarios/me/",
    "personal/../usuarios/foto/",
    "configuracion/visual/logo/otro/",
    "autogestion/soportes/no-es-uuid/archivo/",
    "autogestion/solicitudes/0197c9a0-1b2c-7d3e-8f40-123456789abc/",
    "autogestion/mi-expediente/",
  ])("rechaza rutas fuera de la lista blanca: %s", async (ruta) => {
    const res = await pedir(ruta, "tok");
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "configuracion/visual/logo/logo-principal/",
    "familiares/9/documentos/4/archivo/",
    "puntocuenta/7/documento/archivo/",
    "autogestion/soportes/0197c9a0-1b2c-7d3e-8f40-123456789abc/archivo/",
  ])("permite %s", async (ruta) => {
    fetchMock.mockResolvedValue(new Response("x", { status: 200 }));
    const res = await pedir(ruta, "tok");
    expect(res.status).toBe(200);
  });

  it("propaga el status del backend (403/404)", async () => {
    fetchMock.mockResolvedValue(new Response("no", { status: 403 }));
    expect((await pedir("personal/1/foto/", "tok")).status).toBe(403);
  });

  it("502 si el backend no responde", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    expect((await pedir("personal/1/foto/", "tok")).status).toBe(502);
  });
});
