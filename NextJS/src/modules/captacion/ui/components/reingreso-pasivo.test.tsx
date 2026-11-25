import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AvisoReingresoPasivo, InsigniaReingresoPasivo } from "./reingreso-pasivo";

describe("Reingreso de pasivo en el detalle de Captación", () => {
  it("muestra la insignia", () => {
    render(<InsigniaReingresoPasivo />);
    expect(screen.getByTestId("insignia-reingreso-pasivo")).toHaveTextContent("Reingreso de pasivo");
  });

  it("explica qué ocurrirá al contratar según la opción del expediente", () => {
    const { rerender } = render(<AvisoReingresoPasivo opcion="cerrar_al_contratar" />);
    expect(screen.getByRole("note")).toHaveTextContent(/jubilado o pensionado/);
    expect(screen.getByRole("note")).toHaveTextContent(/cerrará su condición de pasivo/);
    rerender(<AvisoReingresoPasivo opcion="permitir" />);
    expect(screen.getByRole("note")).toHaveTextContent(/se deja como está/);
  });
});
