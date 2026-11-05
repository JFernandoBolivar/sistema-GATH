import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AyudaPermisoCamara } from "./ayuda-permiso-camara";

describe("AyudaPermisoCamara", () => {
  it("inicia plegado con el botón accesible de ayuda", () => {
    render(<AyudaPermisoCamara />);
    const boton = screen.getByRole("button", {
      name: /problemas con el permiso de la cámara/i,
    });
    expect(boton).toBeInTheDocument();
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("guia-android")).not.toBeInTheDocument();
  });

  it("se despliega y muestra las instrucciones para Android e iOS", () => {
    render(<AyudaPermisoCamara />);
    const boton = screen.getByRole("button", {
      name: /problemas con el permiso de la cámara/i,
    });
    fireEvent.click(boton);

    expect(boton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("guia-android")).toBeInTheDocument();
    expect(screen.getByText(/candado/i)).toBeInTheDocument();
    expect(screen.getByText(/Cámara frontal por defecto/i)).toBeInTheDocument();

    // Cambiar a pestaña iOS
    const botonIos = screen.getByRole("tab", { name: /iPhone \/ iPad/i });
    fireEvent.click(botonIos);

    expect(screen.getByTestId("guia-ios")).toBeInTheDocument();
    expect(screen.getByText(/«aA»/i)).toBeInTheDocument();
  });
});
