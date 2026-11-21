import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ decode: vi.fn() }));

import { valorDeCookieDeSesion } from "./sesion-postulante";

describe("valorDeCookieDeSesion", () => {
  it("lee la cookie directa", () => {
    expect(valorDeCookieDeSesion([{ name: "authjs.session-token", value: "abc" }], "authjs.session-token")).toBe("abc");
  });

  it("une los fragmentos en orden numérico", () => {
    const cookies = [
      { name: "authjs.session-token.1", value: "BB" },
      { name: "authjs.session-token.10", value: "KK" },
      { name: "authjs.session-token.0", value: "AA" },
      { name: "otra", value: "x" },
    ];
    expect(valorDeCookieDeSesion(cookies, "authjs.session-token")).toBe("AABBKK");
  });

  it("sin cookie devuelve null", () => {
    expect(valorDeCookieDeSesion([{ name: "otra", value: "x" }], "authjs.session-token")).toBeNull();
  });
});
