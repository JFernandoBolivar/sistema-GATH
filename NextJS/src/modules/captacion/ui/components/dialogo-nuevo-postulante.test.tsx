import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AltaPostulanteResultado } from "../../domain/expediente";
import { DialogoNuevoPostulante } from "./dialogo-nuevo-postulante";

const ALTA: AltaPostulanteResultado = {
  expedienteId: "e1",
  numero: "POS-2026-0001",
  esReingreso: false,
  mensaje: "Postulante creado.",
  credencial: { usuario: "18123456", claveTemporal: "Tmp-Secreta-77", ventana: 1, venceEl: "2026-12-01T12:00:00Z", debeCambiarClave: true },
};

type Crear = React.ComponentProps<typeof DialogoNuevoPostulante>["crear"];

function creador(r: Awaited<ReturnType<Crear>>) {
  return vi.fn<Crear>().mockResolvedValue(r);
}

function montar(crear: Crear = creador({ ok: true, data: ALTA })) {
  const onCerrar = vi.fn();
  const utils = render(<Wrapper crear={crear} onCerrar={onCerrar} />);
  return { crear, onCerrar, ...utils };
}

function Wrapper({ crear, onCerrar }: { crear: Crear; onCerrar: () => void }) {
  const [abierto, setAbierto] = React.useState(true);
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}>reabrir</button>
      <DialogoNuevoPostulante abierto={abierto} onCerrar={() => { setAbierto(false); onCerrar(); }} crear={crear} />
    </>
  );
}

async function llenar() {
  await userEvent.type(screen.getByLabelText(/cédula de identidad/i), "18123456");
  await userEvent.type(screen.getByLabelText(/nombres/i), "Ana María");
  await userEvent.type(screen.getByLabelText(/apellidos/i), "Pérez");
}

describe("<DialogoNuevoPostulante />", () => {
  it("no envía con datos inválidos y marca los errores", async () => {
    const { crear } = montar();
    await userEvent.type(screen.getByLabelText(/nombres/i), "Juan3");
    await userEvent.click(screen.getByRole("button", { name: /crear postulante/i }));
    expect(await screen.findByText(/indique la cédula/i)).toBeInTheDocument();
    expect(screen.getByText(/solo se admiten letras y espacios/i)).toBeInTheDocument();
    expect(crear).not.toHaveBeenCalled();
  });

  it("al crear muestra la credencial con la advertencia de una sola vez", async () => {
    const { crear } = montar();
    await llenar();
    await userEvent.click(screen.getByRole("button", { name: /crear postulante/i }));
    expect(await screen.findByTestId("credencial-clave")).toHaveTextContent("Tmp-Secreta-77");
    expect(screen.getByTestId("credencial-usuario")).toHaveTextContent("18123456");
    expect(screen.getByText(/no se volverá a mostrar/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copiar contraseña temporal/i })).toBeInTheDocument();
    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ cedula: "18123456", nombres: "Ana María", apellidos: "Pérez" }));
  });

  it("la credencial se muestra UNA sola vez: tras confirmarla no vuelve a aparecer", async () => {
    const { onCerrar } = montar();
    await llenar();
    await userEvent.click(screen.getByRole("button", { name: /crear postulante/i }));
    await screen.findByTestId("credencial-clave");
    await userEvent.click(screen.getByRole("button", { name: /ya la entregué/i }));
    expect(onCerrar).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Tmp-Secreta-77")).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /reabrir/i }));
    expect(await screen.findByRole("button", { name: /crear postulante/i })).toBeInTheDocument();
    expect(screen.queryByText("Tmp-Secreta-77")).not.toBeInTheDocument();
    expect((screen.getByLabelText(/cédula de identidad/i) as HTMLInputElement).value).toBe("");
  });

  it("no guarda la clave en el almacenamiento del navegador", async () => {
    montar();
    await llenar();
    await userEvent.click(screen.getByRole("button", { name: /crear postulante/i }));
    await screen.findByTestId("credencial-clave");
    expect(JSON.stringify({ ...localStorage })).not.toContain("Tmp-Secreta-77");
    expect(JSON.stringify({ ...sessionStorage })).not.toContain("Tmp-Secreta-77");
  });

  it("indica el reingreso", async () => {
    montar(creador({ ok: true, data: { ...ALTA, esReingreso: true } }));
    await llenar();
    await userEvent.click(screen.getByRole("button", { name: /crear postulante/i }));
    expect(await screen.findByText(/es un reingreso/i)).toBeInTheDocument();
  });

  it("muestra el error del servidor y no pasa a la credencial", async () => {
    montar(creador({ ok: false, error: "Ya existe un expediente abierto para esa cédula." }));
    await llenar();
    await userEvent.click(screen.getByRole("button", { name: /crear postulante/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/ya existe un expediente abierto/i);
    expect(screen.queryByTestId("credencial-clave")).not.toBeInTheDocument();
  });

  it("sin correo escrito la opción por correo está deshabilitada y se crea «en persona»", async () => {
    const { crear } = montar();
    expect(screen.getByRole("radio", { name: /enviar enlace por correo/i })).toBeDisabled();
    await llenar();
    await userEvent.click(screen.getByRole("button", { name: /crear postulante/i }));
    await waitFor(() => expect(crear).toHaveBeenCalled());
    expect(vi.mocked(crear).mock.calls[0][0]).toMatchObject({ cedula: "18123456", entrega: "persona" });
  });

  it("con correo se puede enviar el enlace: manda entrega «correo» y confirma sin mostrar contraseña", async () => {
    const alta: AltaPostulanteResultado = {
      ...ALTA,
      credencial: { ...ALTA.credencial, claveTemporal: "", enlace: { enviadoA: "an***@ejemplo.invalid", venceEl: "2026-11-26T12:00:00Z" } },
    };
    const { crear } = montar(creador({ ok: true, data: alta }));
    await llenar();
    await userEvent.type(screen.getByLabelText(/correo \(opcional\)/i), "ana@ejemplo.invalid");
    expect(screen.getByText(/confirma el correo con la persona antes de enviar/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /enviar enlace por correo/i }));
    await userEvent.click(screen.getByRole("button", { name: /crear y enviar enlace/i }));
    expect(await screen.findByTestId("enlace-enviado")).toHaveTextContent("an***@ejemplo.invalid");
    expect(vi.mocked(crear).mock.calls[0][0]).toMatchObject({ correo: "ana@ejemplo.invalid", entrega: "correo" });
    expect(screen.queryByTestId("credencial-clave")).not.toBeInTheDocument();
  });
});
