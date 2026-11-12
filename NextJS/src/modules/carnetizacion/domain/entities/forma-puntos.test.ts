import { describe, expect, it } from "vitest";

import type { ElementoKonva } from "./disenador";
import {
  agregarPuntoCercano,
  cornerRadiusParaRect,
  eliminarPunto,
  generarPathDesdePuntos,
  moverPunto,
  puntosDesdePath,
  radiosEsquinasMm,
  validarPathSvg,
  type PuntoForma,
} from "./forma-puntos";
import {
  COLOR_ACENTO_INSTITUCIONAL,
  COLOR_BANDA_TENUE,
  COLOR_PRIMARIO_INSTITUCIONAL,
  crearElementoDeForma,
  FORMAS_INSTITUCIONALES,
} from "./formas-institucionales";

const cuadrado: PuntoForma[] = [
  { x: 0, y: 0, r: 0 },
  { x: 100, y: 0, r: 0 },
  { x: 100, y: 100, r: 0 },
  { x: 0, y: 100, r: 0 },
];

describe("generarPathDesdePuntos", () => {
  it("con radio 0 genera solo líneas (M, L, Z)", () => {
    expect(generarPathDesdePuntos(cuadrado, 40, 40)).toBe("M 0 0 L 100 0 L 100 100 L 0 100 Z");
  });

  it("con radio > 0 curva solo esa esquina con una Q cuyo control es el vértice", () => {
    const puntos = cuadrado.map((p, i) => (i === 1 ? { ...p, r: 10 } : p));
    const path = generarPathDesdePuntos(puntos, 40, 40);
    // 10 mm sobre 40 mm = 25 % de la caja
    expect(path).toBe("M 0 0 L 75 0 Q 100 0 100 25 L 100 100 L 0 100 Z");
    expect(path.match(/Q/g)).toHaveLength(1);
  });

  it("el radio se acota a la mitad de la arista más corta", () => {
    const puntos = cuadrado.map((p, i) => (i === 2 ? { ...p, r: 999 } : p));
    expect(generarPathDesdePuntos(puntos, 40, 40)).toContain("L 100 50 Q 100 100 50 100");
  });

  it("devuelve vacío con menos de 3 puntos o caja inválida", () => {
    expect(generarPathDesdePuntos(cuadrado.slice(0, 2), 10, 10)).toBe("");
    expect(generarPathDesdePuntos(cuadrado, 0, 10)).toBe("");
  });
});

describe("edición de vértices", () => {
  it("agrega un vértice sobre el borde más cercano al clic", () => {
    const { puntos, indice } = agregarPuntoCercano(cuadrado, 50, 3);
    expect(puntos).toHaveLength(5);
    expect(indice).toBe(1);
    expect(puntos[1]).toEqual({ x: 50, y: 0, r: 0 });
  });

  it("elimina un vértice pero nunca baja de 3", () => {
    const tres = eliminarPunto(cuadrado, 1);
    expect(tres).toHaveLength(3);
    expect(eliminarPunto(tres, 0)).toHaveLength(3);
  });

  it("mueve un vértice dentro de la caja 0..100", () => {
    expect(moverPunto(cuadrado, 2, 140, -5)[2]).toMatchObject({ x: 100, y: 0 });
  });

  it("lee un path con rectas y curvas absolutas como vértices", () => {
    expect(puntosDesdePath("M 0 0 H 100 V 100 L 0 100 Z")).toHaveLength(4);
    expect(puntosDesdePath("m 0 0 l 10 10 l 0 10 z")).toBeNull();
  });
});

describe("validarPathSvg", () => {
  it("acepta M, L, H, V, C, Q y Z con números", () => {
    expect(validarPathSvg("M 0 100 C 0 32 32 0 100 0 V 100 Z").valido).toBe(true);
    expect(validarPathSvg("M 0 0 Q 50 0 100 50 L 0 100 Z").valido).toBe(true);
  });

  it("rechaza una instrucción no válida y dice cuál", () => {
    const r = validarPathSvg("M 0 100 C 0 32 32 0 100 0 V 100 y");
    expect(r).toEqual({ valido: false, mensaje: 'Instrucción no válida: "y"' });
  });

  it("rechaza arcos, números faltantes y texto sin M inicial", () => {
    expect(validarPathSvg("M 0 0 A 5 5 0 0 1 10 10").valido).toBe(false);
    expect(validarPathSvg("M 0 0 L 10").valido).toBe(false);
    expect(validarPathSvg("L 0 0 L 10 10").valido).toBe(false);
    expect(validarPathSvg("   ").valido).toBe(false);
  });
});

describe("radios por esquina del rectángulo", () => {
  const rect = { w: 40, h: 20, rad: 3 };

  it("sin radios usa el radio único en las cuatro esquinas", () => {
    expect(radiosEsquinasMm(rect)).toEqual([3, 3, 3, 3]);
    expect(cornerRadiusParaRect(rect, 4)).toBe(12);
  });

  it("con radios llegan al Rect de Konva como arreglo [sup-izq, sup-der, inf-der, inf-izq] en px", () => {
    expect(cornerRadiusParaRect({ ...rect, radios: [0, 5, 0, 2] }, 4)).toEqual([0, 20, 0, 8]);
  });

  it("acota cada radio a la mitad del lado menor", () => {
    expect(radiosEsquinasMm({ ...rect, radios: [50, 0, 0, 0] })[0]).toBe(10);
  });
});

describe("Formas institucionales", () => {
  it("hay seis presets con id único", () => {
    expect(FORMAS_INSTITUCIONALES).toHaveLength(6);
    expect(new Set(FORMAS_INSTITUCIONALES.map((f) => f.id)).size).toBe(6);
  });

  it.each(FORMAS_INSTITUCIONALES.map((f) => [f.id, f] as const))(
    "%s inserta una Forma SVG con path válido, puntos y colores por defecto",
    (_id, forma) => {
      const el: Omit<ElementoKonva, "id"> = crearElementoDeForma(forma, "reverso");
      expect(el.t).toBe("path");
      expect(el.cara).toBe("reverso");
      expect(validarPathSvg(el.path ?? "").valido).toBe(true);
      expect(el.path).toBe(generarPathDesdePuntos(el.puntos ?? [], el.w, el.h));
      expect(el.puntos!.length).toBeGreaterThanOrEqual(3);
      // Dentro de la tarjeta de 54 x 85,6 mm
      expect(el.x + el.w).toBeLessThanOrEqual(54.01);
      expect(el.y + el.h).toBeLessThanOrEqual(85.61);
      expect(["rule:primario", "rule:acento", COLOR_BANDA_TENUE]).toContain(el.fill);
    },
  );

  it("azul con la regla Primario (#14284b), rojo con Acento (#c8102e) y banda #f2f3f5", () => {
    const por = (id: string) => FORMAS_INSTITUCIONALES.find((f) => f.id === id)!;
    expect(por("encabezado-diagonal").elemento.fill).toBe("rule:primario");
    expect(por("encabezado-diagonal").colorMiniatura).toBe(COLOR_PRIMARIO_INSTITUCIONAL);
    expect(por("franja-esquina").elemento.fill).toBe("rule:acento");
    expect(por("pie-diagonal-derecho").colorMiniatura).toBe(COLOR_ACENTO_INSTITUCIONAL);
    expect(por("banda-tenue").elemento.fill).toBe("#f2f3f5");
    expect(COLOR_PRIMARIO_INSTITUCIONAL).toBe("#14284b");
    expect(COLOR_ACENTO_INSTITUCIONAL).toBe("#c8102e");
  });
});
