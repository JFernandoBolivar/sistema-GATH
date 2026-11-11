import { describe, expect, it } from "vitest";

import { destinoPostLogin } from "./destino-post-login";

const ORIGIN = "https://gath.example.com";

describe("destinoPostLogin", () => {
  it.each([
    [null],
    [""],
    ["//evil.com"],
    ["//evil.com/login"],
    ["/\\evil.com"],
    ["https://evil.com"],
    ["javascript:alert(1)"],
    ["dashboard"],
  ])("rechaza %s", (callback) => {
    expect(destinoPostLogin(callback, ORIGIN)).toBe("/dashboard");
  });

  it("acepta rutas internas con query y hash", () => {
    expect(destinoPostLogin("/dashboard/personal?x=1#a", ORIGIN)).toBe("/dashboard/personal?x=1#a");
  });
});
