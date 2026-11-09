import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { ApiHttpError } from "@/shared/infrastructure/http/errors";
import { GET } from "./route";

vi.mock("@/shared/infrastructure/http/fetcher-api", () => ({
  apiClient: { get: vi.fn() },
}));

const ID = "0190f3a2-7b1c-4e55-8a9d-1234567890ab";

function pedir(id: string) {
  return GET(new NextRequest(`http://localhost:3001/api/exportaciones/${id}`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/exportaciones/{id}", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it("reenvía el estado del trabajo", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: "success", data: { id: ID, estado: "LISTO" } });
    const respuesta = await pedir(ID);
    expect(respuesta.status).toBe(200);
    expect((await respuesta.json()).data.estado).toBe("LISTO");
    expect(vi.mocked(apiClient.get).mock.calls[0][0]).toBe(`/api/v1/exportaciones/${ID}/`);
  });

  it("rechaza un identificador que no es UUID sin llamar al backend", async () => {
    const respuesta = await pedir("../../auth/me");
    expect(respuesta.status).toBe(400);
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it("propaga el 404 de una exportación ajena", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new ApiHttpError("La exportación solicitada no existe.", 404));
    const respuesta = await pedir(ID);
    expect(respuesta.status).toBe(404);
    expect((await respuesta.json()).error).toContain("no existe");
  });
});
