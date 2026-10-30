import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { ApiHttpError } from "@/shared/infrastructure/http/errors";
import { GET } from "./route";

vi.mock("@/shared/infrastructure/http/fetcher-api", () => ({ apiClient: { getBlobConRespuesta: vi.fn() } }));

describe("debug", () => {
  it("dump", async () => {
    vi.mocked(apiClient.getBlobConRespuesta).mockRejectedValue(new ApiHttpError("x", 403));
    const req = new NextRequest("http://localhost:3001/api/movimientos/pdf");
    try {
      const r = await GET(req, { params: Promise.resolve({ formato: "pdf" }) });
      console.log("STATUS", r.status, await r.text());
      expect(r.status).toBe(403);
    } catch (e) {
      console.log("THREW", e);
      throw e;
    }
  });
});