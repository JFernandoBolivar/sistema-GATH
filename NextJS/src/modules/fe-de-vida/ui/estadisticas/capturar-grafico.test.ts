import { describe, expect, it } from "vitest";
import {
  MAX_LADO_GRAFICO,
  agregarLeyendaSvg,
  dimensionesCanvas,
} from "./capturar-grafico";

const NS = "http://www.w3.org/2000/svg";

describe("agregarLeyendaSvg", () => {
  it("dibuja una muestra y un texto por entrada y devuelve el alto agregado", () => {
    const svg = document.createElementNS(NS, "svg");
    const extra = agregarLeyendaSvg(
      svg,
      [
        { nombre: "Respondieron", color: "#0B4A9E" },
        { nombre: "Faltan", color: "#8EC5FF" },
      ],
      480,
      300,
    );
    expect(extra).toBeGreaterThan(0);
    const textos = Array.from(svg.querySelectorAll("g[data-leyenda] text")).map((t) => t.textContent);
    expect(textos).toEqual(["Respondieron", "Faltan"]);
    expect(svg.querySelectorAll("g[data-leyenda] rect")).toHaveLength(2);
    const y = Number(svg.querySelector("g[data-leyenda] text")?.getAttribute("y"));
    expect(y).toBeGreaterThan(300);
  });

  it("pasa a una segunda fila cuando las entradas no caben en el ancho", () => {
    const svg = document.createElementNS(NS, "svg");
    const extra = agregarLeyendaSvg(
      svg,
      [
        { nombre: "Respondieron: 1840", color: "#0B4A9E" },
        { nombre: "Faltan por responder: 312", color: "#8EC5FF" },
      ],
      260,
      240,
    );
    const ys = new Set(Array.from(svg.querySelectorAll("g[data-leyenda] text")).map((t) => t.getAttribute("y")));
    expect(ys.size).toBe(2);
    expect(extra).toBe(52);
  });

  it("no cambia nada cuando no hay leyenda", () => {
    const svg = document.createElementNS(NS, "svg");
    expect(agregarLeyendaSvg(svg, [], 480, 300)).toBe(0);
    expect(svg.children).toHaveLength(0);
  });

  it("mantiene la leyenda dentro del ancho aun con entradas largas", () => {
    const svg = document.createElementNS(NS, "svg");
    agregarLeyendaSvg(svg, [{ nombre: "Faltan por responder: 1234", color: "#000" }], 480, 100);
    const x = Number(svg.querySelector("g[data-leyenda] rect")?.getAttribute("x"));
    expect(x).toBeGreaterThanOrEqual(0);
  });
});

describe("dimensionesCanvas", () => {
  it("reduce la escala para no superar MAX_LADO_GRAFICO conservando la proporción", () => {
    const grandes = dimensionesCanvas(1366, 420, 3);
    expect(Math.max(grandes.ancho, grandes.alto)).toBeLessThanOrEqual(MAX_LADO_GRAFICO);
    expect(grandes.ancho / grandes.alto).toBeCloseTo(1366 / 420, 1);
  });

  it("mantiene la escala cuando el gráfico ya cabe", () => {
    expect(dimensionesCanvas(640, 320, 3)).toEqual({ ancho: 1920, alto: 960 });
  });

  it("acota también una captura a escala 1 con ancho excesivo", () => {
    const ancho = dimensionesCanvas(3200, 400, 1);
    expect(ancho.ancho).toBe(MAX_LADO_GRAFICO);
    expect(ancho.alto).toBeLessThanOrEqual(MAX_LADO_GRAFICO);
  });

  it.each([1366, 1517, 1920, 360])("acota el ancho de pantalla %i px", (viewport) => {
    const resultado = dimensionesCanvas(viewport, 420, 3);
    expect(Math.max(resultado.ancho, resultado.alto)).toBeLessThanOrEqual(MAX_LADO_GRAFICO);
  });
});
