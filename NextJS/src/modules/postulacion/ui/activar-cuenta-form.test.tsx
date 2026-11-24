import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const activar = vi.hoisted(() => vi.fn());
vi.mock("../infrastructure/actions/postulacion-actions", () => ({ activarCuentaAction: activar }));

import { ActivarCuentaForm } from "./activar-cuenta-form";

const TOKEN = "a".repeat(43);

async function llenar(cedula = "12345678", clave = "Clave2026Segura", confirmacion = clave) {
  await userEvent.type(screen.getByLabelText(/cédula de identidad/i), cedula);
  await userEvent.type(screen.getByLabelText(/^contraseña nueva/i), clave);
  await userEvent.type(screen.getByLabelText(/repite la contraseña nueva/i), confirmacion);
}

const montar = () => render(<ActivarCuentaForm token={TOKEN} numero="EXP-2026-00007" venceEl="2026-12-01T16:00:00Z" />);

describe("<ActivarCuentaForm />", () => {
  beforeEach(() => activar.mockReset());

  it("muestra el número de postulación, el vencimiento y las reglas en vivo", async () => {
    montar();
    expect(screen.getByText("EXP-2026-00007")).toBeInTheDocument();
    expect(screen.getByText(/este enlace vence el 01\/12\/2026/i)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /reglas de la contraseña nueva/i }).querySelectorAll("li")).toHaveLength(4);
    await userEvent.type(screen.getByLabelText(/^contraseña nueva/i), "Clave2026Segura");
    expect(screen.getAllByText("(cumple)")).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: /mostrar contraseña/i })).toHaveLength(2);
  });

  it("no llama al servidor con datos inválidos (contraseñas distintas)", async () => {
    montar();
    await llenar("12345678", "Clave2026Segura", "Otra2026Segura");
    await userEvent.click(screen.getByRole("button", { name: /crear contraseña y entrar/i }));
    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeInTheDocument();
    expect(activar).not.toHaveBeenCalled();
  });

  it("una cédula que no coincide se marca en el campo con un mensaje genérico", async () => {
    activar.mockResolvedValue({ ok: false, codigo: "ACTIVACION_DATOS_INCORRECTOS", titulo: "No pudimos verificar tus datos", mensaje: "Revisa tu cédula e inténtalo de nuevo." });
    montar();
    await llenar();
    await userEvent.click(screen.getByRole("button", { name: /crear contraseña y entrar/i }));
    expect(await screen.findByText("No pudimos verificar tus datos")).toBeInTheDocument();
    expect(activar).toHaveBeenCalledWith({ token: TOKEN, cedula: "12345678", claveNueva: "Clave2026Segura", confirmacion: "Clave2026Segura" });
    expect(screen.getAllByText(/revisa tu cédula/i).length).toBeGreaterThan(0);
  });

  it("un enlace agotado cambia la pantalla a «Pide a Captación un enlace nuevo»", async () => {
    activar.mockResolvedValue({ ok: false, codigo: "ENLACE_VENCIDO", titulo: "Este enlace venció", mensaje: "x" });
    montar();
    await llenar();
    await userEvent.click(screen.getByRole("button", { name: /crear contraseña y entrar/i }));
    await waitFor(() => expect(screen.getByTestId("enlace-no-disponible")).toHaveAttribute("data-codigo", "ENLACE_VENCIDO"));
    expect(screen.getByText("Pide a Captación un enlace nuevo.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/cédula de identidad/i)).not.toBeInTheDocument();
  });
});
