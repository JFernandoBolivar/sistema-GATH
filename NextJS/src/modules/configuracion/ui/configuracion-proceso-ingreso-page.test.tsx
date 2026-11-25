import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfiguracionProcesoIngresoPage } from "./configuracion-proceso-ingreso-page";
import type { ParametroDTO } from "../application/dtos/parametro-dto";

const p = (clave: string, etiqueta: string, tipo: "booleano" | "entero", valor: string): ParametroDTO => ({
  clave, etiqueta, descripcion: "desc", grupo: "captacion", tipo, valor, defecto: valor, minimo: 1, maximo: 180,
  actualizadoPorId: null, actualizadoEn: null, opciones: [], seccion: "proceso_ingreso",
});
const mock = [
  p("captacion.requiere_presupuesto", "Presupuesto", "booleano", "true"),
  p("captacion.requiere_direccion_general", "DG", "booleano", "true"),
  p("captacion.psicofisico_obligatorio", "Psico", "booleano", "true"),
  p("captacion.vigencia_reserva_puesto_dias", "Vigencia", "entero", "30"),
  {
    ...p("captacion.reingreso_pasivo", "Reingreso de jubilados y pensionados", "entero", "permitir"),
    tipo: "texto",
    opciones: [
      { valor: "permitir", etiqueta: "Permitir" },
      { valor: "cerrar_al_contratar", etiqueta: "Cerrar al contratar" },
      { valor: "no_permitir", etiqueta: "No permitir" },
    ],
  },
];
const actualizar = vi.fn(async () => ({ success: true }));

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { permisos: ["configuracion.editar"] } } }) }));
vi.mock("swr", () => ({ default: () => ({ data: mock, error: undefined, isLoading: false, mutate: vi.fn() }) }));
vi.mock("../infrastructure/actions/parametros-actions", () => ({
  listarParametrosAction: vi.fn(async () => mock),
  actualizarParametroAction: (...a: unknown[]) => actualizar(...(a as [])),
}));

describe("Proceso de ingreso", () => {
  it("muestra las casillas, el aviso y pide confirmación antes de guardar", async () => {
    render(<ConfiguracionProcesoIngresoPage />);
    expect(screen.getByText(/aplican a los expedientes nuevos/i)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /revisión de presupuesto en el sistema/i })).toBeChecked();
    expect(screen.getByRole("switch", { name: /aprobación de dirección general en el sistema/i })).toBeChecked();
    expect(screen.getByRole("switch", { name: /test psicofísico obligatorio/i })).toBeChecked();
    expect(screen.getByRole("button", { name: /guardar cambios/i })).toBeDisabled();

    await userEvent.click(screen.getByRole("switch", { name: /aprobación de dirección general/i }));
    expect(screen.getByText(/firmarlo en físico/i)).toBeInTheDocument();
    expect(screen.getByTestId("ruta-proceso").querySelector('[data-etapa="direccion"]')).toHaveAttribute("data-en-sistema", "false");

    await userEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    expect(actualizar).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(actualizar).toHaveBeenCalledWith("captacion.requiere_direccion_general", "false"));
  });

  it("ofrece tres opciones de reingreso de pasivos, con «permitir» marcada, y guarda la elegida", async () => {
    actualizar.mockClear();
    render(<ConfiguracionProcesoIngresoPage />);
    const permitir = screen.getByRole("radio", { name: /permitir el reingreso y dejar su registro/i });
    const cerrar = screen.getByRole("radio", { name: /cerrar su condición de pasivo al contratarlo/i });
    const no = screen.getByRole("radio", { name: /no permitir que un pasivo se postule/i });
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(permitir).toBeChecked();
    expect(cerrar).not.toBeChecked();
    expect(no).not.toBeChecked();
    expect(cerrar).toHaveClass("relative", "z-10");
    expect(screen.getByText(/da por terminada su condición de pasivo/i)).toBeInTheDocument();

    await userEvent.click(cerrar);
    expect(cerrar).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(actualizar).toHaveBeenCalledWith("captacion.reingreso_pasivo", "cerrar_al_contratar"));
  });
});
