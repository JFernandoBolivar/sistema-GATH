import { describe, expect, it } from "vitest";
import { validarNombreMotivoNuevo } from "./operacion-motivo";

describe("validarNombreMotivoNuevo", () => {
  const existentes = ["RENUNCIA", "Fin de contrato"];

  it("acepta entre 3 y 100 caracteres", () => {
    expect(validarNombreMotivoNuevo("Mutuo acuerdo", existentes)).toBeNull();
    expect(validarNombreMotivoNuevo("abc", existentes)).toBeNull();
    expect(validarNombreMotivoNuevo("x".repeat(100), existentes)).toBeNull();
  });

  it("rechaza menos de 3 y más de 100 caracteres (ignora espacios de los bordes)", () => {
    expect(validarNombreMotivoNuevo("  ab  ", existentes)).toMatch(/al menos 3/);
    expect(validarNombreMotivoNuevo("x".repeat(101), existentes)).toMatch(/100/);
  });

  it("rechaza duplicados sin distinguir mayúsculas ni espacios repetidos", () => {
    expect(validarNombreMotivoNuevo("renuncia", existentes)).toMatch(/Ya existe/);
    expect(validarNombreMotivoNuevo("FIN   DE  CONTRATO", existentes)).toMatch(/Ya existe/);
  });

  it("rechaza marcado HTML", () => {
    expect(validarNombreMotivoNuevo("<b>motivo</b>", existentes)).not.toBeNull();
  });
});
