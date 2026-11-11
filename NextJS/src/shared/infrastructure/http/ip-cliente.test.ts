import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn() }));

import { elegirIp } from "./ip-cliente";

describe("elegirIp (F2-05)", () => {
  it("prefiere x-real-ip, que fija el proxy", () => {
    expect(elegirIp("198.51.100.4", "1.1.1.1, 198.51.100.4")).toBe("198.51.100.4");
  });

  it("sin x-real-ip usa el último salto, no el que inventa el cliente", () => {
    expect(elegirIp(null, "6.6.6.6, 203.0.113.7")).toBe("203.0.113.7");
  });

  it("descarta valores que no son IP", () => {
    expect(elegirIp("<script>", "no-es-ip")).toBeNull();
    expect(elegirIp(null, null)).toBeNull();
  });

  it("acepta IPv6", () => {
    expect(elegirIp("2001:db8::1", null)).toBe("2001:db8::1");
  });
});
