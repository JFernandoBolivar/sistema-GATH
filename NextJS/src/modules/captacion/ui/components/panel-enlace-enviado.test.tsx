import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PanelCredencial } from "./panel-credencial";

describe("entrega por correo en el panel de credencial", () => {
  it("confirma el envío con el correo enmascarado y sin contraseña", async () => {
    const onEntendido = vi.fn();
    render(
      <PanelCredencial
        credencial={{ usuario: "", claveTemporal: "", ventana: null, venceEl: "2026-12-01T16:00:00Z", debeCambiarClave: false, enlace: { enviadoA: "ju***@gmail.com", venceEl: "2026-12-01T16:00:00Z" } }}
        onEntendido={onEntendido}
      />,
    );
    expect(screen.getByTestId("enlace-enviado")).toHaveTextContent(/enlace enviado a ju\*\*\*@gmail\.com, vence el 01\/12\/2026/i);
    expect(screen.queryByTestId("credencial-clave")).not.toBeInTheDocument();
    expect(screen.queryByText(/contraseña temporal/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /entendido/i }));
    expect(onEntendido).toHaveBeenCalled();
  });
});
