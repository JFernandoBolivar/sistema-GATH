import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { InfoRow } from "./info-row";

describe("InfoRow", () => {
  it("muestra el valor cuando es válido", () => {
    render(<InfoRow label="Cédula" value="V-30540767" />);
    expect(screen.getByText("Cédula")).toBeDefined();
    expect(screen.getByText("V-30540767")).toBeDefined();
  });

  it("sustituye 'nan' por 'No posee' por defecto", () => {
    render(<InfoRow label="Teléfono Habitación" value="nan" />);
    expect(screen.getByText("Teléfono Habitación")).toBeDefined();
    expect(screen.getByText("No posee")).toBeDefined();
  });

  it("sustituye null o cadena vacía por 'No posee' por defecto", () => {
    render(<InfoRow label="Teléfono Móvil" value={null} />);
    expect(screen.getByText("No posee")).toBeDefined();
  });

  it("permite personalizar el texto para valores ausentes", () => {
    render(<InfoRow label="Carnet de la Patria" value="nan" emptyText="No reportado" />);
    expect(screen.getByText("No reportado")).toBeDefined();
  });
});
