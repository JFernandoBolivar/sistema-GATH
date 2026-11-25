import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { ApiHttpError, SessionExpiredError } from "@/shared/infrastructure/http/errors";
import { GET } from "./route";

vi.mock("@/shared/infrastructure/http/fetcher-api", () => ({
  apiClient: { getResponse: vi.fn() },
}));

const ID = "0190f3a2-7b1c-4e55-8a9d-1234567890ab";

function pedir(id: string) {
  return GET(new NextRequest(`http://localhost/api/documentos/generados/${id}/archivo/`), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  vi.mocked(apiClient.getResponse).mockReset();
});

describe("GET /api/documentos/generados/{id}/archivo", () => {
  it("entrega el PDF autenticado como adjunto y sin caché", async () => {
    vi.mocked(apiClient.getResponse).mockResolvedValue(
      new Response("%PDF", {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      }),
    );
    const respuesta = await pedir(ID);

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("Content-Type")).toBe("application/pdf");
    expect(respuesta.headers.get("Content-Disposition")).toBe(`attachment; filename="documento_${ID}.pdf"`);
    expect(respuesta.headers.get("Cache-Control")).toBe("private, no-store");
    expect(respuesta.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await respuesta.text()).toBe("%PDF");
    expect(apiClient.getResponse).toHaveBeenCalledWith(`/api/v1/documentos/generados/${ID}/archivo/`);
  });

  it("rechaza identificadores inválidos sin llamar al backend", async () => {
    const respuesta = await pedir("../../auth/me");
    expect(respuesta.status).toBe(400);
    expect(apiClient.getResponse).not.toHaveBeenCalled();
  });

  it.each([
    [401, () => new ApiHttpError("No autorizado.", 401)],
    [403, () => new ApiHttpError("Sin permiso.", 403)],
    [404, () => new ApiHttpError("No existe.", 404)],
    [401, () => new SessionExpiredError()],
  ])("conserva el estado %s del error", async (estado, crearError) => {
    const error = crearError();
    vi.mocked(apiClient.getResponse).mockRejectedValue(error);
    const respuesta = await pedir(ID);
    expect(respuesta.status).toBe(estado);
    expect(respuesta.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await respuesta.json()).error).toBe(error.message);
  });
});
