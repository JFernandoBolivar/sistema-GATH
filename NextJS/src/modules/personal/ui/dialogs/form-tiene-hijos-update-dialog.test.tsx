import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const accion = vi.hoisted(() => vi.fn());
vi.mock("../../infrastructure/actions/personal-actions", () => ({
  actualizarTieneHijosAction: accion,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import FormTieneHijosUpdateDialog from "./form-tiene-hijos-update-dialog";

describe("FormTieneHijosUpdateDialog", () => {
  beforeEach(() => accion.mockReset());

  it("abre el diálogo, guarda Sí y avisa al padre", async () => {
    accion.mockResolvedValue({ tieneHijos: true });
    const onGuardado = vi.fn();
    render(<FormTieneHijosUpdateDialog cedula="123" tieneHijos={null} onGuardado={onGuardado} />);

    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await userEvent.click(screen.getByLabelText("Sí"));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(accion).toHaveBeenCalledWith("123", true));
    await waitFor(() => expect(onGuardado).toHaveBeenCalled());
  });

  it("precarga el valor actual y permite cambiarlo a No", async () => {
    accion.mockResolvedValue({ tieneHijos: false });
    render(<FormTieneHijosUpdateDialog cedula="123" tieneHijos={true} onGuardado={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(screen.getByLabelText("Sí")).toBeChecked();
    await userEvent.click(screen.getByLabelText("No"));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(accion).toHaveBeenCalledWith("123", false));
  });

  it("sin selección pide elegir y no llama al servidor", async () => {
    render(<FormTieneHijosUpdateDialog cedula="123" tieneHijos={null} onGuardado={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Seleccione Sí o No.")).toBeInTheDocument();
    expect(accion).not.toHaveBeenCalled();
  });

  it("muestra el error del servidor y no cierra ni refresca", async () => {
    accion.mockResolvedValue({ error: "No posee permiso." });
    const onGuardado = vi.fn();
    render(<FormTieneHijosUpdateDialog cedula="123" tieneHijos={false} onGuardado={onGuardado} />);

    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("No posee permiso.")).toBeInTheDocument();
    expect(onGuardado).not.toHaveBeenCalled();
  });
});
