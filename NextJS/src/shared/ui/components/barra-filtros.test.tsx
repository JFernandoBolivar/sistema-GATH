import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { BarraFiltros, type FiltroActivoChip } from "./barra-filtros";

describe("Componente BarraFiltros (FIX-DIS1)", () => {
  it("renderiza la barra de búsqueda y propaga cambios", () => {
    const handleBusqueda = vi.fn();
    render(
      <BarraFiltros
        busqueda="V123"
        onBusquedaChange={handleBusqueda}
        placeholderBusqueda="Buscar trabajador…"
      />,
    );

    const input = screen.getByLabelText("Buscar trabajador…");
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).value).toBe("V123");

    fireEvent.change(input, { target: { value: "V1234" } });
    expect(handleBusqueda).toHaveBeenCalledWith("V1234");
  });

  it("muestra el contador de resultados y la etiqueta correspondiente", () => {
    render(
      <BarraFiltros
        totalResultados={42}
        etiquetaResultados="reportes encontrados"
      />,
    );

    expect(screen.getByText("42")).toBeDefined();
    expect(screen.getByText("reportes encontrados")).toBeDefined();
  });

  it("muestra el botón Limpiar filtros solo si hay filtros activos y ejecuta el callback", () => {
    const handleLimpiar = vi.fn();
    const { rerender } = render(
      <BarraFiltros
        hayFiltrosActivos={false}
        onLimpiarFiltros={handleLimpiar}
      />,
    );

    expect(screen.queryByLabelText("Limpiar todos los filtros")).toBeNull();

    rerender(
      <BarraFiltros
        hayFiltrosActivos={true}
        onLimpiarFiltros={handleLimpiar}
      />,
    );

    const boton = screen.getByLabelText("Limpiar todos los filtros");
    expect(boton).toBeDefined();
    fireEvent.click(boton);
    expect(handleLimpiar).toHaveBeenCalledTimes(1);
  });

  it("renderiza chips de filtros activos y permite removerlos individualmente", () => {
    const handleRemoverEstado = vi.fn();
    const chips: FiltroActivoChip[] = [
      {
        id: "estado",
        label: "Estado",
        valorLegible: "Pendientes",
        onRemover: handleRemoverEstado,
      },
    ];

    render(
      <BarraFiltros
        hayFiltrosActivos={true}
        chipsActivos={chips}
      />,
    );

    expect(screen.getByText("Estado:")).toBeDefined();
    expect(screen.getByText("Pendientes")).toBeDefined();

    const botonQuitar = screen.getByLabelText("Quitar filtro Estado: Pendientes");
    expect(botonQuitar).toBeDefined();
    fireEvent.click(botonQuitar);
    expect(handleRemoverEstado).toHaveBeenCalledTimes(1);
  });

  it("renderiza los controles hijos dentro de la grilla de filtros", () => {
    render(
      <BarraFiltros>
        <div data-testid="select-estado">Select Estado</div>
        <div data-testid="select-dato">Select Dato</div>
      </BarraFiltros>,
    );

    expect(screen.getAllByTestId("select-estado").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("select-dato").length).toBeGreaterThan(0);
  });
});
