import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DetalleExpediente } from "../../domain/expediente";
import { IndicadorEtapasExpediente } from "./indicador-etapas-expediente";

function detalle(estado: string, flujo: DetalleExpediente["flujo"]): DetalleExpediente {
  return {
    expediente: {
      contactoPendiente: false,
      contactoPendienteDesde: null,
      contactoAtrasado: false,
      id: "e1",
      numero: "EXP-2026-00001",
      estado,
      ventana: 1,
      venceEl: null,
      fechaApertura: null,
      fechaCierre: null,
      observaciones: "",
      esReingreso: false,
      propuesta: {} as DetalleExpediente["expediente"]["propuesta"],
    },
    flujo,
    reserva: null,
    puntoCuenta: null,
    postulante: {
      id: "p1",
      cedula: "12345678",
      nombres: "Ana",
      apellidos: "Pérez",
      correo: "",
      telefonoMovil: "",
      esReingreso: false,
      esPasivo: false,
    },
    datosVentana1: {},
    datosVentana2: {},
    datosVentana2Legible: null,
    ventana2Faltantes: null,
    foto: { tiene: false, subidaEl: null, tamano: null, url: null },
    enlaceActivacion: null,
    historial: [],
    psicofisico: {} as DetalleExpediente["psicofisico"],
    acciones: [],
  };
}

describe("<IndicadorEtapasExpediente />", () => {
  it("muestra las siete etapas y marca la actual", () => {
    render(
      <IndicadorEtapasExpediente
        detalle={detalle("CONSOLIDANDO", { requierePresupuesto: true, requiereDireccionGeneral: true, reingresoPasivo: "permitir" })}
      />,
    );
    expect(screen.getByRole("heading", { name: "Etapas del expediente" })).toBeInTheDocument();
    expect(screen.getByText("1. Datos iniciales")).toBeInTheDocument();
    expect(screen.getByText("7. Contratación")).toBeInTheDocument();
    expect(screen.getByTestId("paso-complementarios")).toHaveAttribute("data-estado", "actual");
    expect(screen.getByText("En curso")).toBeInTheDocument();
  });

  it("muestra «Fuera del sistema» cuando Presupuesto y Dirección General están desactivados", () => {
    render(
      <IndicadorEtapasExpediente
        detalle={detalle("ENVIADO_CAPTACION", {
          requierePresupuesto: false,
          requiereDireccionGeneral: false,
          reingresoPasivo: "permitir",
        })}
      />,
    );
    expect(screen.getByTestId("paso-presupuesto")).toHaveAttribute("data-estado", "fuera_sistema");
    expect(screen.getByTestId("paso-direccion")).toHaveAttribute("data-estado", "fuera_sistema");
    expect(screen.getAllByText("Fuera del sistema")).toHaveLength(2);
    expect(screen.getByTestId("paso-revision")).toHaveAttribute("data-estado", "actual");
  });
});
