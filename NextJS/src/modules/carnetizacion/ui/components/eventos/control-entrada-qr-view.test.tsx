import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const acciones = vi.hoisted(() => ({
  getEventosAction: vi.fn(),
  getZonasEventoAction: vi.fn(),
  checkInAccesoAction: vi.fn(),
}));

vi.mock("@/modules/carnetizacion/infrastructure/actions/eventos-actions", () => acciones);

import { ControlEntradaQrView } from "./control-entrada-qr-view";

// Radix Select llama scrollIntoView al abrir; jsdom no lo implementa.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

describe("ControlEntradaQrView", () => {
  beforeEach(() => {
    acciones.getEventosAction.mockReset().mockResolvedValue([
      { id: "ev-1", nombre: "Evento de prueba" },
    ]);
    acciones.getZonasEventoAction.mockReset().mockResolvedValue([
      { id: "zona-1", nombre: "Puerta principal" },
    ]);
    acciones.checkInAccesoAction.mockReset().mockResolvedValue({
      resultado: "ACCESO_PERMITIDO",
      mensaje: "OK",
      invitado_id: "1",
      nombre_completo: "Invitado",
      documento_identidad: "V-1",
      organizacion: "",
      categoria_nombre: "",
      zona_nombre: "",
      mesa: "",
      codigo_credencial: "INV-1",
      hora_ingreso_formateada: "10:00",
    });
  });

  it("renderiza y abre el selector de zonas sin value vacío", async () => {
    render(<ControlEntradaQrView />);

    expect(await screen.findByText(/Control de Entrada/)).toBeInTheDocument();
    await waitFor(() => expect(acciones.getEventosAction).toHaveBeenCalled());

    const combos = screen.getAllByRole("combobox");
    fireEvent.click(combos[1]);
    expect(await screen.findByText("Todas las zonas")).toBeInTheDocument();
  });
});
