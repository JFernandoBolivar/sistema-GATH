import { beforeAll, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ANCHOS_EXPORTACION } from "./graficos-estadisticas";
import { GraficosExportacion, leyendasExportacion, type DatosGraficosExportacion } from "./graficos-exportacion";
import { createRef } from "react";

const DATOS: DatosGraficosExportacion = {
  donut: [
    { name: "Respondieron", value: 75 },
    { name: "Faltan por responder", value: 25 },
  ],
  total: 100,
  tipos: [{ name: "PENSIONADO SOBREVIVIENTE", respondieron: 3, faltan: 1 }],
  estados: [{ name: "Validada", total: 50 }],
};

beforeAll(() => {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: false,
    media: consulta,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe("copias de gráficos para el PDF", () => {
  it("la leyenda de cobertura incluye la cifra de cada porción y la de tipos sus dos series", () => {
    const leyendas = leyendasExportacion(DATOS);
    expect(leyendas.cobertura.map((e) => e.nombre)).toEqual(["Respondieron: 75", "Faltan por responder: 25"]);
    expect(leyendas.tipos.map((e) => e.nombre)).toEqual(["Respondieron", "Faltan"]);
    expect(leyendas.estados).toEqual([]);
  });

  it("se monta fuera de pantalla con el ancho lógico de exportación y sin leyenda HTML", () => {
    const refs = { cobertura: createRef<HTMLDivElement>(), tipos: createRef<HTMLDivElement>(), estados: createRef<HTMLDivElement>() };
    const { getByTestId } = render(<GraficosExportacion datos={DATOS} refs={refs} />);
    const raiz = getByTestId("graficos-exportacion");
    expect(raiz.getAttribute("aria-hidden")).toBe("true");
    expect(refs.tipos.current?.parentElement?.style.width).toBe(`${ANCHOS_EXPORTACION.tipos}px`);
    expect(refs.cobertura.current?.parentElement?.style.width).toBe(`${ANCHOS_EXPORTACION.cobertura}px`);
    expect(Math.max(...Object.values(ANCHOS_EXPORTACION))).toBeLessThanOrEqual(960);
    expect(raiz.querySelector(".recharts-legend-wrapper")).toBeNull();
    expect(refs.tipos.current).not.toBeNull();
  });
});
