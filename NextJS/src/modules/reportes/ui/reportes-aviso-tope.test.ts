import { describe, expect, it } from "vitest";

import { avisoTopeDeFilas } from "./reportes-aviso-tope";

describe("aviso de tope de filas del reporte", () => {
  it("no avisa nada si el reporte está completo", () => {
    expect(avisoTopeDeFilas({ truncado: false, total: 120, limite: 5000 })).toBeNull();
  });

  it("avisa cuántos registros quedaron fuera al alcanzar el tope", () => {
    const aviso = avisoTopeDeFilas({ truncado: true, total: 6123, limite: 5000 });
    expect(aviso).toContain("5.000");
    expect(aviso).toContain("6.123");
    expect(aviso).toContain("tope");
  });

  it("avisa aunque el backend no informe el total ni el tope", () => {
    expect(avisoTopeDeFilas({ truncado: true, total: null, limite: null })).toContain("tope");
  });

  it("usa solo el tope cuando no hay total", () => {
    const aviso = avisoTopeDeFilas({ truncado: true, total: null, limite: 500 });
    expect(aviso).toContain("500");
    expect(aviso).toContain("Aplique más filtros");
  });
});
