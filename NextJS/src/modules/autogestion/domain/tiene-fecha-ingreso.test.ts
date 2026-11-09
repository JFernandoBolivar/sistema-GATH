import { describe, expect, it } from "vitest";

import { tieneFechaIngresoApn } from "./tiene-fecha-ingreso";

describe("tieneFechaIngresoApn (FIX-AUD7)", () => {
  it("reconoce la fecha de ingreso del contrato actual", () => {
    expect(tieneFechaIngresoApn("2020-01-01", [])).toBe(true);
  });

  it("reconoce una fecha de ingreso en los antecedentes", () => {
    expect(
      tieneFechaIngresoApn(undefined, [
        { fecha_ingreso: null },
        { fecha_ingreso: "2015-03-01" },
      ]),
    ).toBe(true);
  });

  it("sin contrato ni antecedentes con fecha devuelve false", () => {
    expect(tieneFechaIngresoApn(null, [])).toBe(false);
    expect(tieneFechaIngresoApn(undefined, undefined)).toBe(false);
    expect(tieneFechaIngresoApn("", [{ fecha_ingreso: "" }])).toBe(false);
  });
});
