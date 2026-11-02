import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CarnetVistaPrevia } from "./carnet-vista-previa";

describe("CarnetVistaPrevia Component (React nativo sin dangerouslySetInnerHTML)", () => {
  it("renderiza datos del titular, cédula y cargo en el DOM con auto-escape", () => {
    render(
      <CarnetVistaPrevia
        cedula="12345678"
        nombreCompleto="Pedro Pérez"
        cargo="Especialista TI"
        departamento="Gerencia de Informática"
      />
    );

    expect(screen.getByText("PEDRO PÉREZ")).toBeInTheDocument();
    expect(screen.getByText("C.I: 12345678")).toBeInTheDocument();
    expect(screen.getByText("ESPECIALISTA TI")).toBeInTheDocument();
    expect(screen.getByText("GERENCIA DE INFORMÁTICA")).toBeInTheDocument();
    expect(screen.getByText("GATH • IDENTIDAD")).toBeInTheDocument();
  });

  it("renderiza payloads XSS como texto plano seguro sin ejecutar scripts", () => {
    const xssPayload = '<img src=x onerror="alert(1)">';
    const { container } = render(
      <CarnetVistaPrevia
        cedula="12345678"
        nombreCompleto={xssPayload}
        cargo="<script>alert('hack')</script>"
      />
    );

    // El nombre debe existir como nodo de texto literal, NO como elemento <img> inyectado
    expect(screen.getByText(xssPayload.toUpperCase())).toBeInTheDocument();
    expect(container.querySelector("img[src='x']")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });

  it("bloquea URLs javascript: en fotoUrl", () => {
    const { container } = render(
      <CarnetVistaPrevia
        cedula="12345678"
        nombreCompleto="Pedro Pérez"
        fotoUrl="javascript:alert(1)"
      />
    );

    // No debe haber tag img con src javascript:
    expect(container.querySelector("img[src^='javascript:']")).toBeNull();
    // Debe mostrar el fallback de foto
    expect(screen.getByText("FOTO")).toBeInTheDocument();
  });

  it("renderiza imagen válida cuando se proporciona una URL segura", () => {
    render(
      <CarnetVistaPrevia
        cedula="12345678"
        nombreCompleto="Pedro Pérez"
        fotoUrl="https://example.com/foto.jpg"
      />
    );

    const img = screen.getByAltText("Fotografía del titular") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe("https://example.com/foto.jpg");
  });
});
