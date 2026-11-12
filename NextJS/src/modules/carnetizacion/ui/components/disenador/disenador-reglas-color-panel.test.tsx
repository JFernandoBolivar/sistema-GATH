import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ReglasColorConfig } from "../../../domain/entities/disenador";
import { DisenadorReglasColorPanel } from "./disenador-reglas-color-panel";

const base: ReglasColorConfig = {
  criterio: "cargo",
  respaldo: { primario: "#111111", acento: "#222222", texto: "#ffffff" },
  valores: {},
};

interface Montaje {
  onActualizar: ReturnType<typeof vi.fn>;
  estado: () => ReglasColorConfig;
}

function montar(
  props: Partial<ComponentProps<typeof DisenadorReglasColorPanel>> = {},
): Montaje {
  const inicial = props.reglasColor ?? base;
  let estado = inicial;
  const onActualizar = vi.fn(
    (actualizar: ReglasColorConfig | ((prev: ReglasColorConfig) => ReglasColorConfig)) => {
      estado = typeof actualizar === "function" ? actualizar(estado) : actualizar;
    },
  );
  render(
    <DisenadorReglasColorPanel
      reglasColor={inicial}
      onActualizarReglasColor={onActualizar}
      nuevoValorNombre=""
      onCambiarNuevoValorNombre={() => undefined}
      {...props}
    />,
  );
  return { onActualizar, estado: () => estado };
}

describe("DisenadorReglasColorPanel — sugerencias de cargo y oficina", () => {
  it("ofrece los cargos reales en el datalist", () => {
    montar({ sugerenciasReglasColor: { cargos: ["ANALISTA", "DIRECTOR"] } });

    const opciones = Array.from(
      document.querySelectorAll<HTMLOptionElement>("#sugerencias-criterio-color option"),
    ).map((o) => o.value);

    expect(opciones).toEqual(["ANALISTA", "DIRECTOR"]);
  });

  it("ofrece las oficinas reales cuando el criterio es oficina", () => {
    montar({
      reglasColor: { ...base, criterio: "oficina" },
      sugerenciasReglasColor: { cargos: ["ANALISTA"], oficinas: ["GESTION HUMANA"] },
    });

    const opciones = Array.from(
      document.querySelectorAll<HTMLOptionElement>("#sugerencias-criterio-color option"),
    ).map((o) => o.value);

    expect(opciones).toEqual(["GESTION HUMANA"]);
  });

  it("«Cargar todos» agrega los valores sugeridos con el color de respaldo", () => {
    const { estado } = montar({
      sugerenciasReglasColor: { cargos: ["ANALISTA", "DIRECTOR"] },
    });

    fireEvent.click(screen.getByRole("button", { name: "Cargar todos (2)" }));

    expect(Object.keys(estado().valores)).toEqual(["ANALISTA", "DIRECTOR"]);
    expect(estado().valores.ANALISTA).toEqual(base.respaldo);
    expect(estado().valores.DIRECTOR).toEqual(base.respaldo);
  });

  it("«Cargar todos» solo cuenta los valores que aún no tienen regla", () => {
    const { estado } = montar({
      reglasColor: {
        ...base,
        valores: {
          ANALISTA: { primario: "#000001", acento: "#000002", texto: "#ffffff" },
        },
      },
      sugerenciasReglasColor: { cargos: ["ANALISTA", "DIRECTOR"] },
    });

    fireEvent.click(screen.getByRole("button", { name: "Cargar todos (1)" }));

    expect(estado().valores.ANALISTA.primario).toBe("#000001");
    expect(estado().valores.DIRECTOR).toEqual(base.respaldo);
  });

  it("sin sugerencias el botón queda deshabilitado", () => {
    montar({ sugerenciasReglasColor: { cargos: [] } });

    expect(screen.getByRole("button", { name: "Cargar todos (0)" })).toBeDisabled();
    expect(
      document.querySelectorAll("#sugerencias-criterio-color option"),
    ).toHaveLength(0);
  });

  it("mientras carga muestra el aviso y deshabilita el botón", () => {
    montar({ cargandoSugerencias: true });

    expect(screen.getByText("Cargando sugerencias…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cargando…" })).toBeDisabled();
  });
});
