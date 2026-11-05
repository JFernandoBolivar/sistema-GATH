import { afterEach, describe, expect, it, vi } from "vitest";
import { nuevaReferencia } from "./nueva-referencia";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("nuevaReferencia", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("genera un UUID v4 sin crypto.randomUUID (contexto HTTP no seguro)", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (a: Uint8Array) => {
        a.fill(7);
        return a;
      },
    });
    expect(nuevaReferencia()).toMatch(UUID);
  });

  it("usa crypto.randomUUID cuando existe", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "abc" });
    expect(nuevaReferencia()).toBe("abc");
  });
});
