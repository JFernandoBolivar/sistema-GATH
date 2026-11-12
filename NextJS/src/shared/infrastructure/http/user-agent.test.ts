import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn() }));

import { headers } from "next/headers";

import { userAgentDelCliente } from "./user-agent";

const mockHeaders = vi.mocked(headers);

describe("userAgentDelCliente", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("devuelve el User-Agent de la petición", async () => {
    mockHeaders.mockResolvedValue({
      get: (name: string) => (name === "user-agent" ? "Mozilla/5.0" : null),
    } as never);

    expect(await userAgentDelCliente()).toBe("Mozilla/5.0");
  });

  it("recorta a 255 caracteres", async () => {
    mockHeaders.mockResolvedValue({
      get: () => "x".repeat(300),
    } as never);

    expect((await userAgentDelCliente())?.length).toBe(255);
  });

  it("fuera de una petición devuelve null", async () => {
    mockHeaders.mockRejectedValue(new Error("headers() fuera de una petición"));

    expect(await userAgentDelCliente()).toBeNull();
  });

  it("sin cabecera devuelve null", async () => {
    mockHeaders.mockResolvedValue({ get: () => null } as never);

    expect(await userAgentDelCliente()).toBeNull();
  });
});
