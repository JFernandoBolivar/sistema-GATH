import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BarraAcciones } from "@/modules/captacion/ui/components/barra-acciones";
import { pasosGuia, type AccionExpediente } from "../../domain/solicitud";
import { GuiaPasos } from "./guia-pasos";

describe("<GuiaPasos />", () => {
  it("muestra los tres pasos con su estado en texto y en data-estado", () => {
    render(<GuiaPasos pasos={pasosGuia({ reserva: null, constancia: null, puntoCuenta: null })} />);
    expect(screen.getByTestId("paso-reserva")).toHaveAttribute("data-estado", "pendiente");
    expect(screen.getByTestId("paso-punto_cuenta")).toHaveAttribute("data-estado", "bloqueado");
    expect(screen.getByText("1. Reservar puesto")).toBeInTheDocument();
    expect(screen.getByText("3. Emitir Punto de Cuenta")).toBeInTheDocument();
    expect(screen.getAllByText("Pendiente")).toHaveLength(2);
    expect(screen.getByText("En espera")).toBeInTheDocument();
  });
});

describe("barra de acciones de Presupuesto (desde acciones[])", () => {
  const acciones: AccionExpediente[] = [
    { destino: "EN_DIRECCION_GENERAL", etiqueta: "Emitir el Punto de Cuenta y enviar a Dirección General", requiereMotivo: false, requierePropuesta: false, bloqueada: true, motivoBloqueo: "Falta reservar el puesto.", sugerida: false },
    { destino: "DIFERIDO_PRESUPUESTO", etiqueta: "Diferir por falta de disponibilidad", requiereMotivo: true, requierePropuesta: false, bloqueada: false, motivoBloqueo: "", sugerida: false },
  ];

  it("la emisión bloqueada muestra su motivo y la de motivo obligatorio entrega el modo «motivo»", () => {
    render(<BarraAcciones acciones={acciones} onElegir={() => undefined} />);
    expect(screen.getByRole("button", { name: /emitir el punto de cuenta/i })).toBeDisabled();
    expect(screen.getByText("Falta reservar el puesto.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /diferir/i })).toBeEnabled();
  });
});
