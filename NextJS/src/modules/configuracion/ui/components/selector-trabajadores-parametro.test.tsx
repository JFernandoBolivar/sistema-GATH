import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SelectorTrabajadoresParametro } from "./selector-trabajadores-parametro";

vi.mock("../../infrastructure/actions/parametros-actions", () => ({
  buscarTrabajadoresParametroAction: vi.fn(async (query?: string, cedulas?: string[]) => {
    if (cedulas && cedulas.includes("12345678")) {
      return [{ cedula: "12345678", nombre: "Juan Pérez", tiene_cuenta: true, cuenta_activa: true }];
    }
    if (query === "Maria") {
      return [{ cedula: "87654321", nombre: "María Gómez", tiene_cuenta: true, cuenta_activa: true }];
    }
    return [];
  }),
}));

describe("SelectorTrabajadoresParametro", () => {
  it("muestra contador y chips de trabajadores seleccionados", async () => {
    const onChange = vi.fn();
    render(<SelectorTrabajadoresParametro valor="12345678" onChange={onChange} />);

    expect(screen.getByText(/1 trabajador seleccionado/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    });
  });

  it("permite quitar un trabajador con el botón ×", async () => {
    const onChange = vi.fn();
    render(<SelectorTrabajadoresParametro valor="12345678" onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    });

    const botonQuitar = screen.getByRole("button", { name: /Quitar Juan Pérez/i });
    fireEvent.click(botonQuitar);

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("muestra 'Ningún trabajador seleccionado' cuando está vacío", () => {
    render(<SelectorTrabajadoresParametro valor="" onChange={vi.fn()} />);
    expect(screen.getByText(/Ningún trabajador seleccionado/i)).toBeInTheDocument();
  });
});
