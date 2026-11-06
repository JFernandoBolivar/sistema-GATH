import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FiltroFechasPar, FiltrosColapsables } from "./filtros-movil-colapsable";

describe("FiltrosColapsables (TLF-D)", () => {
  it("renderiza el título y los elementos hijos", () => {
    render(
      <FiltrosColapsables titulo="Filtros del sistema">
        <div data-testid="contenido-filtro">Campos de búsqueda</div>
      </FiltrosColapsables>,
    );

    expect(screen.getByText("Filtros del sistema")).toBeInTheDocument();
    expect(screen.getByTestId("contenido-filtro")).toBeInTheDocument();
  });

  it("muestra el badge con la cantidad de filtros activos", () => {
    render(
      <FiltrosColapsables conteoActivos={3}>
        <div>Contenido</div>
      </FiltrosColapsables>,
    );

    expect(screen.getByText("3 activos")).toBeInTheDocument();
  });

  it("permite alternar la visibilidad en móvil con el botón", () => {
    render(
      <FiltrosColapsables inicialmenteAbierto={false} conteoActivos={0}>
        <div data-testid="hijo">Contenido</div>
      </FiltrosColapsables>,
    );

    const boton = screen.getByRole("button", { name: /mostrar filtros/i });
    expect(boton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /ocultar filtros/i })).toBeInTheDocument();
  });
});

describe("FiltroFechasPar (TLF-D)", () => {
  it("organiza dos campos de fechas en una cuadrícula compacta", () => {
    const { container } = render(
      <FiltroFechasPar>
        <input data-testid="fecha-desde" type="date" />
        <input data-testid="fecha-hasta" type="date" />
      </FiltroFechasPar>,
    );

    const contenedor = container.firstElementChild;
    expect(contenedor).toHaveClass("grid");
    expect(contenedor).toHaveClass("grid-cols-2");
    expect(screen.getByTestId("fecha-desde")).toBeInTheDocument();
    expect(screen.getByTestId("fecha-hasta")).toBeInTheDocument();
  });
});
