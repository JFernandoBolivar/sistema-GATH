import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Textarea } from "./textarea";

describe("Textarea — FIX-DIS6 / PRUEBAS-USUARIO P15 (tamaño fijo y prohibición de resize)", () => {
  it("aplica resize-none por defecto", () => {
    render(<Textarea aria-label="Comentarios" />);
    const el = screen.getByLabelText("Comentarios");
    expect(el.className).toContain("resize-none");
  });

  it("garantiza resize-none incluso si el consumidor intenta sobrescribir con resize-y o resize-x", () => {
    render(<Textarea aria-label="Texto con resize-y" className="resize-y" />);
    const el = screen.getByLabelText("Texto con resize-y");

    // resize-none colocado al final de cn() debe neutralizar resize-y
    expect(el.className).toContain("resize-none");
    expect(el.className).not.toContain("resize-y");
  });

  it("oculta el contador si mostrarContador={false}", () => {
    render(
      <Textarea
        aria-label="Sin contador"
        maxLength={500}
        mostrarContador={false}
      />,
    );
    expect(screen.queryByText(/500/)).toBeNull();
  });
});
