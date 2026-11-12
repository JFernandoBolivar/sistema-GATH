import { describe, expect, it } from "vitest";

import {
  camposViviendaVisibles,
  nombreEsVenezuela,
} from "./vivienda-ubicacion";

describe("regla de visibilidad de la vivienda", () => {
  it("sin país y sin vivienda se asume Venezuela", () => {
    expect(camposViviendaVisibles(null, false)).toEqual({
      mostrarPais: false,
      mostrarCiudadRegion: false,
      mostrarUbicacionVenezuela: true,
    });
  });

  it("sin país resuelto no se asume Venezuela", () => {
    expect(camposViviendaVisibles(null)).toEqual({
      mostrarPais: true,
      mostrarCiudadRegion: true,
      mostrarUbicacionVenezuela: false,
    });
  });

  it("Venezuela muestra la geografía nacional y no ciudad o región", () => {
    expect(camposViviendaVisibles({ es_venezuela: true })).toEqual({
      mostrarPais: false,
      mostrarCiudadRegion: false,
      mostrarUbicacionVenezuela: true,
    });
  });

  it("el exterior muestra país y ciudad o región, y oculta la geografía nacional", () => {
    expect(camposViviendaVisibles({ es_venezuela: false })).toEqual({
      mostrarPais: true,
      mostrarCiudadRegion: true,
      mostrarUbicacionVenezuela: false,
    });
  });
});

describe("nombreEsVenezuela", () => {
  it("reconoce Venezuela sin importar mayúsculas ni acentos", () => {
    expect(nombreEsVenezuela("Venezuela")).toBe(true);
    expect(nombreEsVenezuela(" VENEZUELA ")).toBe(true);
  });

  it("reconoce otro país", () => {
    expect(nombreEsVenezuela("Albania")).toBe(false);
    expect(nombreEsVenezuela("Chile")).toBe(false);
  });

  it("distingue un nombre aún sin resolver", () => {
    expect(nombreEsVenezuela("Cargando…")).toBeNull();
    expect(nombreEsVenezuela("—")).toBeNull();
    expect(nombreEsVenezuela("Código 2")).toBeNull();
    expect(nombreEsVenezuela(null)).toBeNull();
  });
});
