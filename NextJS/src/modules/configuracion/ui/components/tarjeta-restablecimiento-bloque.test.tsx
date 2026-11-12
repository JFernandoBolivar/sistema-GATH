import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TarjetaRestablecimientoBloque } from "./tarjeta-restablecimiento-bloque";
import { ADVERTENCIA_TODOS } from "../schema/schema-restablecimiento-bloque";

const calcular = vi.fn();
const ejecutar = vi.fn();
const estado = vi.fn();
const excel = vi.fn();

vi.mock("next/navigation", () => ({
  unstable_rethrow: (e: unknown) => {
    throw e;
  },
}));
vi.mock("@/shared/lib/exportaciones-asincronas", () => ({ guardarArchivo: vi.fn() }));
vi.mock("../../infrastructure/actions/restablecimiento-bloque-actions", () => ({
  calcularRestablecimientoBloqueAction: (...a: unknown[]) => calcular(...a),
  ejecutarRestablecimientoBloqueAction: (...a: unknown[]) => ejecutar(...a),
  estadoRestablecimientoBloqueAction: (...a: unknown[]) => estado(...a),
  descargarExcelRestablecimientoBloqueAction: (...a: unknown[]) => excel(...a),
}));

const PREVIA = {
  revisadas: 47,
  activos: 12,
  pasivos: 33,
  total: 45,
  omitidasAdministrativas: 2,
  muestra: [
    { cuentaId: 1, cedula: "12345678", nombre: "PEREZ JUAN", condicion: "ACTIVO", venceEn: "2026-11-03T10:00:00-04:00" },
  ],
  venceEnNuevo: "2026-12-11",
};
const LISTO = {
  taskId: "",
  estado: "LISTO",
  mensaje: null,
  resultado: { revisadas: 47, restablecidas: 45, omitidas: 2, errores: 0, venceEnNuevo: "2026-12-11" },
};

function abrir() {
  render(<TarjetaRestablecimientoBloque />);
  fireEvent.click(screen.getByRole("button", { name: "Restablecer contraseñas en bloque" }));
}

async function irAlPaso2() {
  fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "Plazo inicial vencido" } });
  fireEvent.click(screen.getByRole("button", { name: /^Siguiente$/ }));
  await screen.findByTestId("vista-previa-bloque");
}

describe("Asistente de restablecimiento en bloque", () => {
  beforeEach(() => {
    calcular.mockReset();
    ejecutar.mockReset();
    estado.mockReset();
    excel.mockReset();
  });

  it("el alcance por defecto es «vencida» y no calcula con un motivo corto", async () => {
    abrir();
    const vencida = await screen.findByRole("radio", { name: /Contraseña inicial vencida/ });
    expect(vencida).toBeChecked();
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "corto" } });
    fireEvent.click(screen.getByRole("button", { name: /^Siguiente$/ }));
    expect(await screen.findByText(/al menos 10 caracteres/)).toBeInTheDocument();
    expect(calcular).not.toHaveBeenCalled();
  });

  it("pasar al paso 2 muestra los contadores, la muestra y el nuevo plazo", async () => {
    calcular.mockResolvedValue(PREVIA);
    abrir();
    await irAlPaso2();
    expect(calcular).toHaveBeenCalledWith(expect.objectContaining({ alcance: "VENCIDA" }));
    expect(screen.getByTestId("cont-total")).toHaveTextContent("45");
    expect(screen.getByTestId("cont-activos")).toHaveTextContent("12");
    expect(screen.getByTestId("cont-pasivos")).toHaveTextContent("33");
    expect(screen.getByTestId("cont-omitidas")).toHaveTextContent("2");
    expect(screen.getByText("PEREZ JUAN")).toBeInTheDocument();
    expect(screen.getByText("03/11/2026")).toBeInTheDocument();
    expect(screen.getByText("Mostrando 1 de 45")).toBeInTheDocument();
    expect(screen.getByText("11/12/2026")).toBeInTheDocument();
  });

  it("con total 0 «Siguiente: Confirmar» queda deshabilitado", async () => {
    calcular.mockResolvedValue({ ...PREVIA, total: 0, activos: 0, pasivos: 0, muestra: [] });
    abrir();
    await irAlPaso2();
    expect(screen.getByText(/No hay cuentas que restablecer con estos filtros/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Siguiente: Confirmar/ })).toBeDisabled();
  });

  it("la confirmación por número habilita el botón y Todos repite la advertencia", async () => {
    calcular.mockResolvedValue(PREVIA);
    abrir();
    fireEvent.click(await screen.findByRole("radio", { name: /Todos \(también/ }));
    await irAlPaso2();
    fireEvent.click(screen.getByRole("button", { name: /Siguiente: Confirmar/ }));
    const boton = await screen.findByRole("button", { name: "Restablecer 45 cuentas" });
    expect(boton).toBeDisabled();
    const campo = screen.getByLabelText(/Escriba 45 para confirmar/);
    fireEvent.change(campo, { target: { value: "44" } });
    expect(boton).toBeDisabled();
    fireEvent.change(campo, { target: { value: "45" } });
    expect(boton).toBeEnabled();
    expect(screen.getAllByText(new RegExp(ADVERTENCIA_TODOS)).length).toBeGreaterThan(0);
  });

  it("el resultado se muestra y «Nuevo restablecimiento» limpia el formulario", async () => {
    calcular.mockResolvedValue(PREVIA);
    ejecutar.mockResolvedValue(LISTO);
    abrir();
    await irAlPaso2();
    fireEvent.click(screen.getByRole("button", { name: /Siguiente: Confirmar/ }));
    fireEvent.change(await screen.findByLabelText(/Escriba 45/), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Restablecer 45 cuentas" }));
    const res = await screen.findByTestId("resultado-bloque");
    expect(res).toHaveTextContent("Se restableció el acceso a 45 cuentas");
    expect(res).toHaveTextContent("11/12/2026");
    expect(res).toHaveTextContent("Correos enviados: no");
    expect(res).toHaveTextContent("Omitidas: 2");

    fireEvent.click(screen.getByRole("button", { name: "Nuevo restablecimiento" }));
    expect(screen.getByLabelText(/Motivo/)).toHaveValue("");
    expect(screen.getByRole("radio", { name: /Contraseña inicial vencida/ })).toBeChecked();
  });

  it("un 409 vuelve al paso 2 recalculando y un 403 muestra que no tiene permiso", async () => {
    calcular.mockResolvedValue(PREVIA);
    ejecutar.mockResolvedValueOnce({ error: "El número de cuentas cambió.", status: 409 });
    abrir();
    await irAlPaso2();
    fireEvent.click(screen.getByRole("button", { name: /Siguiente: Confirmar/ }));
    fireEvent.change(await screen.findByLabelText(/Escriba 45/), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Restablecer 45 cuentas" }));
    expect(await screen.findByText(/El número de cuentas cambió\./)).toBeInTheDocument();
    expect(screen.getByTestId("vista-previa-bloque")).toBeInTheDocument();
    expect(calcular).toHaveBeenCalledTimes(2);

    ejecutar.mockResolvedValueOnce({ error: "Prohibido", status: 403 });
    fireEvent.click(screen.getByRole("button", { name: /Siguiente: Confirmar/ }));
    fireEvent.change(await screen.findByLabelText(/Escriba 45/), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Restablecer 45 cuentas" }));
    await waitFor(() => expect(screen.getByText(/Solo el superadministrador/)).toBeInTheDocument());
  });
});
