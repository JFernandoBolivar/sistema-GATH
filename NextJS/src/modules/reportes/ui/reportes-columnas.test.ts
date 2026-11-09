import { describe, expect, it } from "vitest";

import { textoTotalApn } from "./reportes-columnas";

describe("textoTotalApn (FIX-QA14)", () => {
  it("muestra el APN como tiempo legible, sin decimales largos", () => {
    expect(textoTotalApn(0.0082, false)).toBe("3 días de servicio en APN");
    expect(textoTotalApn(4.5, false)).toBe("4 años y 6 meses de servicio en APN");
    expect(textoTotalApn(0.0082, false)).not.toMatch(/\d+\.\d+/);
  });

  it("muestra un guion cuando no hay fecha de ingreso", () => {
    expect(textoTotalApn(0, true)).toBe("—");
    expect(textoTotalApn(4.5, true)).toBe("—");
  });
});
