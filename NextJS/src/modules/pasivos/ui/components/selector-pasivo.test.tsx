import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SelectorPasivo } from "./selector-pasivo";

describe("SelectorPasivo", () => {
  it("vacío: busca con la cédula escrita", async () => {
    const onBuscar = vi.fn();
    render(<SelectorPasivo pasivo={null} buscando={false} error={null} onBuscar={onBuscar} onCambiar={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Pasivo a egresar"), "123");
    await userEvent.click(screen.getByRole("button", { name: /buscar/i }));
    expect(onBuscar).toHaveBeenCalledWith("123");
  });

  it("muestra el error sin resultados", () => {
    render(<SelectorPasivo pasivo={null} buscando={false} error="No se encontró" onBuscar={vi.fn()} onCambiar={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se encontró");
  });

  it("seleccionado: muestra la tarjeta y permite cambiar", async () => {
    const onCambiar = vi.fn();
    render(
      <SelectorPasivo
        pasivo={{ nombreCompleto: "Ana Pérez", cedula: "999", tipoPasivo: "Jubilado" }}
        buscando={false}
        error={null}
        onBuscar={vi.fn()}
        onCambiar={onCambiar}
      />,
    );
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("999")).toBeInTheDocument();
    expect(screen.getByText("AP")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /cambiar/i }));
    expect(onCambiar).toHaveBeenCalled();
  });
});
