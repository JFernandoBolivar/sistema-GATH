import { describe, expect, it } from "vitest";

import { alturaGraficoTipos, etiquetaValor, envolverTexto } from "./graficos-estadisticas";

describe("envolverTexto (TLF4)", () => {
  it("parte etiquetas largas por palabras completas", () => {
    expect(envolverTexto("HONORARIOS PROFESIONALES")).toEqual(["HONORARIOS", "PROFESIONALES"]);
    expect(envolverTexto("PENSIONADO SOBREVIVIENTE")).toEqual(["PENSIONADO", "SOBREVIVIENTE"]);
  });

  it("deja intactas las etiquetas cortas", () => {
    expect(envolverTexto("JUBILADO")).toEqual(["JUBILADO"]);
    expect(envolverTexto("")).toEqual([""]);
  });
});

describe("alturaGraficoTipos (TLF4)", () => {
  it("reserva altura suficiente según las categorías", () => {
    expect(alturaGraficoTipos(2)).toBe(280);
    expect(alturaGraficoTipos(6)).toBe(348);
  });
});

describe("etiquetaValor (TLF4)", () => {
  it("oculta los ceros para que no choquen con la barra", () => {
    expect(etiquetaValor(0)).toBe("");
    expect(etiquetaValor(3)).toBe("3");
    expect(etiquetaValor(null)).toBe("");
  });
});
