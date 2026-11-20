import { describe, expect, it } from "vitest";

import { etiquetaCondicion, etiquetaEstadoFisico, puedeEmitirCarnet } from "./carnet";

describe("condición del titular en la consola de emisión", () => {
  it("muestra la condición real que calcula el servidor", () => {
    expect(etiquetaCondicion("ACTIVO")).toBe("ACTIVO");
    expect(etiquetaCondicion("PASIVO")).toBe("PASIVO");
    expect(etiquetaCondicion("SIN_ASIGNACION")).toBe("SIN ASIGNACIÓN");
  });

  it("solo ofrece emitir a quien tiene asignación vigente", () => {
    expect(puedeEmitirCarnet("ACTIVO")).toBe(true);
    expect(puedeEmitirCarnet("PASIVO")).toBe(true);
    expect(puedeEmitirCarnet("SIN_ASIGNACION")).toBe(false);
  });

  it("un servidor anterior sin el campo no bloquea la emisión (el backend decide)", () => {
    expect(puedeEmitirCarnet(undefined)).toBe(true);
    expect(etiquetaCondicion(undefined)).toBe("ACTIVO");
  });
});

describe("estado físico del carnet (B-5)", () => {
  it("describe cada etapa del ciclo", () => {
    expect(etiquetaEstadoFisico("EMITIDO")).toMatch(/pendiente de impresión/);
    expect(etiquetaEstadoFisico("IMPRESO")).toMatch(/listo para entregar/);
    expect(etiquetaEstadoFisico("ENTREGADO")).toMatch(/Entregado/);
    expect(etiquetaEstadoFisico(undefined)).toMatch(/pendiente de impresión/);
  });
});
