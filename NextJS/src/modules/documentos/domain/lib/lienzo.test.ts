import { describe, expect, it } from "vitest";

import {
  ajustarAPaso,
  arrastrarCampo,
  empujarCampo,
  limitarCampoALaPagina,
  limitarZoom,
  mmAPx,
  pxAMm,
  redimensionarCampo,
  zoomParaAncho,
} from "./lienzo";

const pagina = { ancho_mm: 200, alto_mm: 100 };
const campo = { x: 10, y: 10, w: 40, h: 10 };

describe("coordenadas del lienzo", () => {
  it("convierte mm y px con distintos zooms", () => {
    expect(mmAPx(10, 2)).toBe(20);
    expect(pxAMm(20, 2)).toBe(10);
    expect(pxAMm(30, 3)).toBe(10);
    expect(pxAMm(5, 0)).toBe(0);
    expect(zoomParaAncho(400, 200)).toBe(2);
    expect(limitarZoom(100)).toBe(8);
    expect(limitarZoom(0.01)).toBe(0.5);
  });
  it("ajusta a 0,5 mm", () => {
    expect(ajustarAPaso(10.3)).toBe(10.5);
    expect(ajustarAPaso(10.2)).toBe(10);
  });
  it("limita el campo a la página", () => {
    expect(limitarCampoALaPagina({ x: -5, y: 95, w: 40, h: 10 }, pagina)).toEqual({ x: 0, y: 90, w: 40, h: 10 });
    expect(limitarCampoALaPagina({ x: 190, y: 0, w: 40, h: 10 }, pagina).x).toBe(160);
    expect(limitarCampoALaPagina({ x: 0, y: 0, w: 0, h: 0 }, pagina).w).toBe(1);
  });
  it("arrastra según el zoom y no sale de la página", () => {
    expect(arrastrarCampo(campo, 20, 10, 2, pagina)).toMatchObject({ x: 20, y: 15 });
    expect(arrastrarCampo(campo, 20, 10, 4, pagina)).toMatchObject({ x: 15, y: 12.5 });
    expect(arrastrarCampo(campo, 9999, 9999, 2, pagina)).toMatchObject({ x: 160, y: 90 });
  });
  it("redimensiona por las asas", () => {
    expect(redimensionarCampo(campo, "se", 20, 10, 2, pagina)).toMatchObject({ x: 10, y: 10, w: 50, h: 15 });
    expect(redimensionarCampo(campo, "no", 20, 10, 2, pagina)).toMatchObject({ x: 20, y: 15, w: 30, h: 5 });
    // tamaño mínimo: la esquina fija se mantiene
    expect(redimensionarCampo(campo, "o", 9999, 0, 2, pagina)).toMatchObject({ x: 49, w: 1 });
    expect(redimensionarCampo(campo, "se", 9999, 9999, 2, pagina)).toMatchObject({ w: 190, h: 90 });
  });
  it("las flechas empujan 0,5 mm y con Shift 5 mm", () => {
    expect(empujarCampo(campo, "ArrowRight", false, pagina).x).toBe(10.5);
    expect(empujarCampo(campo, "ArrowDown", true, pagina).y).toBe(15);
    expect(empujarCampo({ ...campo, x: 0 }, "ArrowLeft", true, pagina).x).toBe(0);
  });
});
