import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AccionExpediente } from "../../domain/expediente";
import { BarraAcciones } from "./barra-acciones";

const acciones: AccionExpediente[] = [
  { destino: "EN_CORRECCION_DATOS", etiqueta: "Devolver con observaciones", requiereMotivo: true, requierePropuesta: false, bloqueada: false, motivoBloqueo: "", sugerida: false },
  { destino: "RECHAZADO_CAPTACION", etiqueta: "Rechazar", requiereMotivo: true, requierePropuesta: false, bloqueada: false, motivoBloqueo: "", sugerida: true },
  { destino: "EN_PRESUPUESTO", etiqueta: "Abrir hacia Presupuesto", requiereMotivo: false, requierePropuesta: true, bloqueada: true, motivoBloqueo: "Falta registrar el resultado psicofísico.", sugerida: false },
];

describe("<BarraAcciones />", () => {
  it("dibuja un botón por acción del servidor", () => {
    render(<BarraAcciones acciones={acciones} onElegir={() => undefined} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("la acción bloqueada está deshabilitada y muestra su motivo", () => {
    render(<BarraAcciones acciones={acciones} onElegir={() => undefined} />);
    const boton = screen.getByRole("button", { name: /abrir hacia presupuesto/i });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute("title", "Falta registrar el resultado psicofísico.");
    expect(screen.getByText("Falta registrar el resultado psicofísico.")).toBeInTheDocument();
  });

  it("destaca la sugerida", () => {
    render(<BarraAcciones acciones={acciones} onElegir={() => undefined} />);
    expect(screen.getByRole("button", { name: /rechazar/i })).toHaveAttribute("data-destacada", "true");
    expect(screen.getByRole("button", { name: /devolver/i })).not.toHaveAttribute("data-destacada");
  });

  it("al elegir una acción que requiere motivo entrega su modo «motivo»", async () => {
    const onElegir = vi.fn();
    render(<BarraAcciones acciones={acciones} onElegir={onElegir} />);
    await userEvent.click(screen.getByRole("button", { name: /devolver con observaciones/i }));
    expect(onElegir).toHaveBeenCalledWith(expect.objectContaining({ destino: "EN_CORRECCION_DATOS", modo: "motivo" }));
  });

  it("no dispara la acción bloqueada", async () => {
    const onElegir = vi.fn();
    render(<BarraAcciones acciones={acciones} onElegir={onElegir} />);
    await userEvent.click(screen.getByRole("button", { name: /abrir hacia presupuesto/i }));
    expect(onElegir).not.toHaveBeenCalled();
  });

  it("sin acciones lo explica", () => {
    render(<BarraAcciones acciones={[]} onElegir={() => undefined} />);
    expect(screen.getByTestId("sin-acciones")).toBeInTheDocument();
  });
});
