import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cambiarPasswordAction = vi.fn();
const toastSuccess = vi.fn();

vi.mock("../infrastructure/actions/auth-actions", () => ({
  cambiarPasswordAction: (...args: unknown[]) => cambiarPasswordAction(...args),
}));
vi.mock("sonner", () => ({ toast: { success: (m: string) => toastSuccess(m) } }));

import { BotonCambiarPassword } from "./boton-cambiar-password";

async function llenar(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(screen.getByLabelText(/contraseña actual/i), "Actual*123");
  await usuario.type(screen.getByLabelText(/^nueva contraseña/i), "Nueva*12345");
  await usuario.type(screen.getByLabelText(/confirmar contraseña/i), "Nueva*12345");
}

describe("BotonCambiarPassword", () => {
  beforeEach(() => {
    cambiarPasswordAction.mockReset();
    toastSuccess.mockReset();
  });

  it("abre el diálogo voluntario y se puede cerrar sin cambiar nada", async () => {
    const usuario = userEvent.setup();
    render(<BotonCambiarPassword />);
    await usuario.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText(/medida de seguridad obligatoria/i)).not.toBeInTheDocument();
    await usuario.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(cambiarPasswordAction).not.toHaveBeenCalled();
  });

  it("cambia la contraseña, avisa y cierra", async () => {
    cambiarPasswordAction.mockResolvedValue({ success: true });
    const usuario = userEvent.setup();
    render(<BotonCambiarPassword />);
    await usuario.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
    await llenar(usuario);
    await usuario.click(screen.getByRole("button", { name: /^cambiar contraseña$/i, hidden: false }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Contraseña actualizada."));
    expect(cambiarPasswordAction).toHaveBeenCalledWith(
      expect.objectContaining({ current_password: "Actual*123", new_password: "Nueva*12345" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("muestra el error del servidor y no cierra", async () => {
    cambiarPasswordAction.mockResolvedValue({ success: false, message: "La contraseña actual no es correcta." });
    const usuario = userEvent.setup();
    render(<BotonCambiarPassword />);
    await usuario.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
    await llenar(usuario);
    await usuario.click(screen.getByRole("button", { name: /^cambiar contraseña$/i }));
    expect(await screen.findByText("La contraseña actual no es correcta.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
