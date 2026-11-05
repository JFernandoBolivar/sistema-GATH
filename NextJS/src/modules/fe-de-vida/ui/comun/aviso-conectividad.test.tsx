import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AvisoConectividad } from "./aviso-conectividad";

describe("AvisoConectividad", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { onLine: true });
  });

  it("no muestra nada si el dispositivo está conectado a internet", () => {
    const { container } = render(<AvisoConectividad />);
    expect(container).toBeEmptyDOMElement();
  });

  it("muestra el aviso accesible «Sin conexión: sus datos están guardados» al desconectarse", () => {
    vi.stubGlobal("navigator", { onLine: false });
    render(<AvisoConectividad />);

    const aviso = screen.getByRole("status");
    expect(aviso).toBeInTheDocument();
    expect(aviso).toHaveTextContent("Sin conexión: sus datos están guardados");
  });

  it("reacciona dinámicamente a eventos online y offline del navegador", () => {
    vi.stubGlobal("navigator", { onLine: true });
    render(<AvisoConectividad />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("status")).toHaveTextContent("Sin conexión: sus datos están guardados");

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
