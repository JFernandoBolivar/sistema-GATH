import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./contexto-guia", () => ({
  useAbrirGuiaActual: () => vi.fn(),
}));

import { BotonGuiaAutogestion } from "./boton-guia-autogestion";

describe("BotonGuiaAutogestion (FIX-GUIA1)", () => {
  it("usa fondo transparente sobre la cabecera oscura", () => {
    render(<BotonGuiaAutogestion />);

    const boton = screen.getByRole("button", { name: /Ver guía/i });
    expect(boton).toHaveClass("bg-transparent", "text-white");
    expect(boton).toHaveAttribute("type", "button");
  });
});
