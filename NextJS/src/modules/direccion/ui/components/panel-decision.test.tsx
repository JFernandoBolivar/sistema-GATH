import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AccionExpediente } from "@/modules/presupuesto/domain/solicitud";
import { PanelDecision } from "./panel-decision";

const base = { requierePropuesta: false, bloqueada: false, motivoBloqueo: "", sugerida: false };
const acciones: AccionExpediente[] = [
  { ...base, destino: "APROBADO", etiqueta: "Aprobar el ingreso", requiereMotivo: false },
  { ...base, destino: "RECHAZADO_DIRECCION", etiqueta: "Rechazar el ingreso", requiereMotivo: true },
];

describe("<PanelDecision />", () => {
  it("dibuja los dos botones que envía el servidor y entrega el modo al elegir", async () => {
    const onElegir = vi.fn();
    render(<PanelDecision acciones={acciones} onElegir={onElegir} />);
    await userEvent.click(screen.getByRole("button", { name: /aprobar el ingreso/i }));
    expect(onElegir).toHaveBeenCalledWith(expect.objectContaining({ destino: "APROBADO", modo: "directa" }));
    await userEvent.click(screen.getByRole("button", { name: /rechazar el ingreso/i }));
    expect(onElegir).toHaveBeenLastCalledWith(expect.objectContaining({ destino: "RECHAZADO_DIRECCION", modo: "motivo" }));
  });

  it("no inventa botones: sin acciones lo explica", () => {
    render(<PanelDecision acciones={[]} onElegir={() => undefined} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByTestId("sin-acciones")).toBeInTheDocument();
  });

  it("un botón bloqueado queda deshabilitado con su motivo visible", async () => {
    const onElegir = vi.fn();
    render(<PanelDecision acciones={[{ ...acciones[0], bloqueada: true, motivoBloqueo: "No tiene permiso" }]} onElegir={onElegir} />);
    const b = screen.getByRole("button", { name: /aprobar el ingreso/i });
    expect(b).toBeDisabled();
    expect(screen.getByText("No tiene permiso")).toBeInTheDocument();
    await userEvent.click(b);
    expect(onElegir).not.toHaveBeenCalled();
  });
});
