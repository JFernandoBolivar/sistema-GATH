import { describe, expect, it } from "vitest";
import {
  EDAD_MINIMA_CEDULA_FAMILIAR,
  esHijoMenorSinCedula,
  esParentescoHijo,
  mostrarCedulaFamiliar,
} from "./reglas-familiar";

const hoy = new Date();
const anio = hoy.getFullYear();

describe("reglas de cédula del familiar", () => {
  it("reconoce el parentesco hijo(a) por el nombre del catálogo", () => {
    expect(esParentescoHijo("HIJO (A)")).toBe(true);
    expect(esParentescoHijo("Hija")).toBe(true);
    expect(esParentescoHijo("HERMANO")).toBe(false);
    expect(esParentescoHijo(null)).toBe(false);
  });

  it("un hijo(a) menor de 9 años queda sin cédula y se le genera", () => {
    const fecha = `${anio - (EDAD_MINIMA_CEDULA_FAMILIAR - 1)}-01-01`;
    expect(esHijoMenorSinCedula("HIJO (A)", fecha)).toBe(true);
    expect(mostrarCedulaFamiliar("HIJO (A)", fecha)).toBe(false);
  });

  it("un hijo(a) de 9 años o más debe tener cédula", () => {
    const fecha = `${anio - EDAD_MINIMA_CEDULA_FAMILIAR}-01-01`;
    expect(esHijoMenorSinCedula("HIJO (A)", fecha)).toBe(false);
    expect(mostrarCedulaFamiliar("HIJO (A)", fecha)).toBe(true);
  });

  it("cualquier otro parentesco exige cédula aunque sea menor de edad", () => {
    const fecha = `${anio - 3}-01-01`;
    expect(esHijoMenorSinCedula("SOBRINO", fecha)).toBe(false);
    expect(mostrarCedulaFamiliar("SOBRINO", fecha)).toBe(true);
  });
});
