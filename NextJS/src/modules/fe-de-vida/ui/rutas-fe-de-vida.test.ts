import { describe, expect, it } from "vitest";

import { baseFeDeVida } from "./rutas-fe-de-vida";

describe("baseFeDeVida", () => {
  it("mantiene los enlaces dentro de Gestión de Pasivos", () => {
    expect(baseFeDeVida("/pasivos/fe-de-vida")).toBe("/pasivos/fe-de-vida");
    expect(baseFeDeVida("/pasivos/fe-de-vida/123")).toBe("/pasivos/fe-de-vida");
  });

  it("usa la ruta de activos para el resto de rutas", () => {
    expect(baseFeDeVida("/personal/fe-de-vida")).toBe("/personal/fe-de-vida");
    expect(baseFeDeVida("/personal/fe-de-vida/123")).toBe("/personal/fe-de-vida");
    expect(baseFeDeVida(null)).toBe("/personal/fe-de-vida");
  });
});
