import { describe, expect, it } from "vitest";

import { maxOrdenHijo } from "./cedula-familiar-vo";

describe("maxOrdenHijo", () => {
  it("con cédula de 8 dígitos caben los órdenes del 1 al 9", () => {
    expect(maxOrdenHijo("12910538")).toBe(9);
  });
  it("con 7 dígitos o menos aplica el tope de 27", () => {
    expect(maxOrdenHijo("1234567")).toBe(27);
  });
  it("con 9 dígitos no cabe ningún orden", () => {
    expect(maxOrdenHijo("990000220")).toBe(0);
  });
  it("sin titular es 0", () => {
    expect(maxOrdenHijo("")).toBe(0);
    expect(maxOrdenHijo(undefined)).toBe(0);
  });
});
