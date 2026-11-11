import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TarjetaRestablecimientoBloque } from "./tarjeta-restablecimiento-bloque";
import { ADVERTENCIA_TODOS } from "../schema/schema-restablecimiento-bloque";

Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.releasePointerCapture = vi.fn();

const calcular = vi.fn();
const ejecutar = vi.fn();
const estado = vi.fn();

vi.mock("next/navigation", () => ({ unstable_rethrow: (e: unknown) => { throw e; } }));
vi.mock("../../infrastructure/actions/restablecimiento-bloque-actions", () => ({
  calcularRestablecimientoBloqueAction: (...a: unknown[]) => calcular(...a),
  ejecutarRestablecimientoBloqueAction: (...a: unknown[]) => ejecutar(...a),
  estadoRestablecimientoBloqueAction: (...a: unknown[]) => estado(...a),
}));

const PREVIA = { taskId: "t1", estado: "EN_PROCESO", resultado: null, mensaje: null };
const LISTO = {
  taskId: "t1",
  estado: "LISTO",
  mensaje: null,
  resultado: { revisadas: 50, restablecidas: 0, omitidas: 3, errores: 0, activos: 30, pasivos: 20, total: 50 },
};

async function calcularConMotivo() {
  fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "Plazo inicial vencido" } });
  fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
  await screen.findByTestId("vista-previa-bloque");
}

describe("TarjetaRestablecimientoBloque", () => {
  beforeEach(() => {
    calcular.mockReset();
    ejecutar.mockReset();
    estado.mockReset();
  });

  it("no calcula con un motivo corto", async () => {
    render(<TarjetaRestablecimientoBloque />);
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "corto" } });
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    expect(await screen.findByText(/al menos 10 caracteres/)).toBeInTheDocument();
    expect(calcular).not.toHaveBeenCalled();
  });

  it("muestra el desglose y habilita Ejecutar solo con el número exacto", async () => {
    calcular.mockResolvedValue(PREVIA);
    estado.mockResolvedValue(LISTO);
    render(<TarjetaRestablecimientoBloque />);
    await calcularConMotivo();
    expect(screen.getByTestId("vista-previa-bloque")).toHaveTextContent("30 activos y 20 pasivos");
    expect(screen.getByTestId("vista-previa-bloque")).toHaveTextContent("3 omitidas");

    fireEvent.click(screen.getByRole("button", { name: "Restablecer…" }));
    const ejecutarBtn = await screen.findByRole("button", { name: "Ejecutar" });
    expect(ejecutarBtn).toBeDisabled();
    const campo = screen.getByLabelText("Número de cuentas");
    fireEvent.change(campo, { target: { value: "49" } });
    expect(ejecutarBtn).toBeDisabled();
    fireEvent.change(campo, { target: { value: "50" } });
    expect(ejecutarBtn).toBeEnabled();
    expect(screen.queryByText(new RegExp(ADVERTENCIA_TODOS))).not.toBeInTheDocument();
  });

  it("con alcance Todos el diálogo muestra la advertencia", async () => {
    calcular.mockResolvedValue(PREVIA);
    estado.mockResolvedValue(LISTO);
    render(<TarjetaRestablecimientoBloque />);
    fireEvent.click(screen.getByLabelText("Alcance"));
    fireEvent.click(await screen.findByRole("option", { name: "Todos" }));
    await calcularConMotivo();
    expect(calcular).toHaveBeenCalledWith(expect.objectContaining({ alcance: "TODOS" }));
    fireEvent.click(screen.getByRole("button", { name: "Restablecer…" }));
    expect(await screen.findByText(new RegExp(ADVERTENCIA_TODOS))).toBeInTheDocument();
  });

  it("un 409 pide recalcular y un 403 muestra que no tiene permiso", async () => {
    calcular.mockResolvedValue(PREVIA);
    estado.mockResolvedValue(LISTO);
    ejecutar.mockResolvedValueOnce({ error: "El número de cuentas cambió.", status: 409 });
    render(<TarjetaRestablecimientoBloque />);
    await calcularConMotivo();
    fireEvent.click(screen.getByRole("button", { name: "Restablecer…" }));
    fireEvent.change(await screen.findByLabelText("Número de cuentas"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Ejecutar" }));
    expect(await screen.findByText(/Vuelva a pulsar «Calcular»/)).toBeInTheDocument();
    expect(screen.queryByTestId("vista-previa-bloque")).not.toBeInTheDocument();

    calcular.mockResolvedValueOnce({ error: "Prohibido", status: 403 });
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    await waitFor(() =>
      expect(screen.getByText(/Solo el superadministrador/)).toBeInTheDocument(),
    );
  });

  it("mientras calcula muestra el aviso y, si la tarea falla, el error", async () => {
    calcular.mockResolvedValue(PREVIA);
    estado.mockResolvedValue({ taskId: "t1", estado: "ERROR", resultado: null, mensaje: "Falló el cálculo." });
    render(<TarjetaRestablecimientoBloque />);
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "Plazo inicial vencido" } });
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    expect(await screen.findByText(/Calculando… puede tardar unos minutos/)).toBeInTheDocument();
    expect(await screen.findByText("Falló el cálculo.")).toBeInTheDocument();
    expect(screen.queryByTestId("vista-previa-bloque")).not.toBeInTheDocument();
  });
});
