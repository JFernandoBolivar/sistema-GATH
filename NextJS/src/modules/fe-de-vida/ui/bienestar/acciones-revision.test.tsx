import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { decisionFake, solicitudFake } from "../../domain/services/fixtures-fe-de-vida";

const devolver = vi.fn();
const rechazar = vi.fn();
const retirar = vi.fn();
const toastOk = vi.fn();
vi.mock("../../infrastructure/actions/fe-de-vida-actions", () => ({
  registrarCheckAction: vi.fn().mockResolvedValue({ ok: true, mensaje: "ok", datos: {} }),
  aprobarDirectoAction: vi.fn().mockResolvedValue({ ok: true, mensaje: "ok", datos: {} }),
  devolverSolicitudAction: (...a: unknown[]) => devolver(...a),
  rechazarSolicitudAction: (...a: unknown[]) => rechazar(...a),
  retirarCheckAction: (...a: unknown[]) => retirar(...a),
}));
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastOk(...a), error: vi.fn() } }));

import { AccionesRevision } from "./acciones-revision";
import { DialogoDevolver } from "./dialogos-decision";

const HORA = /\d{2}\/\d{2}\/\d{4}/;

beforeEach(() => {
  devolver.mockReset().mockResolvedValue({ ok: true, mensaje: "Devuelta", datos: {} });
  rechazar.mockReset().mockResolvedValue({ ok: true, mensaje: "Rechazada", datos: {} });
  retirar.mockReset().mockResolvedValue({ ok: true, mensaje: "Check retirado.", datos: {} });
  toastOk.mockReset();
});

describe("AccionesRevision: solo se pintan las acciones que declara el servidor", () => {
  it("revisor sin check previo: check, devolver y rechazar, sin aprobación directa ni retiro", () => {
    render(<AccionesRevision solicitud={solicitudFake()} acciones={["dar_check", "devolver", "rechazar"]} onHecho={vi.fn()} />);
    expect(screen.getByRole("button", { name: /dar check/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /devolver para corrección/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rechazar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aprobación directa/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /retirar mi check/i })).toBeNull();
  });

  it("la Administradora que ya dio su check: aprobación directa y retirar; ni devolver, ni rechazar, ni otro check", () => {
    const s = solicitudFake({
      estado: "PENDIENTE_SEGUNDO_CHECK",
      decisiones: [decisionFake({ rol: "ADMINISTRADORA", actorCedula: "30799436", actorNombre: "Elena Soto", fecha: "2026-10-30T14:05:00Z" })],
    });
    render(<AccionesRevision solicitud={s} acciones={["aprobar_directo", "retirar_check"]} onHecho={vi.fn()} />);
    expect(screen.getByRole("button", { name: /aprobación directa/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retirar mi check/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /devolver/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^rechazar$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /dar check/i })).toBeNull();
    const estado = screen.getByRole("status");
    expect(estado).toHaveTextContent(/usted dio el primer check el/i);
    expect(estado).toHaveTextContent(HORA);
    expect(estado).toHaveTextContent(/falta el check de analista de bienestar social/i);
  });

  it("el Analista que ya dio su check solo ve «Retirar mi check» y se le indica que falta la Administradora", () => {
    const s = solicitudFake({ estado: "PENDIENTE_SEGUNDO_CHECK", decisiones: [decisionFake({ rol: "ANALISTA" })] });
    render(<AccionesRevision solicitud={s} acciones={["retirar_check"]} onHecho={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(/falta el check de administradora/i);
  });

  it("el otro revisor ve las tres acciones y el nombre (no la cédula) ni el código en minúsculas de quien dio el primer check", () => {
    const s = solicitudFake({
      estado: "PENDIENTE_SEGUNDO_CHECK",
      decisiones: [decisionFake({ rol: "ADMINISTRADORA", actorCedula: "30799436", actorNombre: "Elena Soto" })],
    });
    render(<AccionesRevision solicitud={s} acciones={["dar_check", "devolver", "rechazar"]} onHecho={vi.fn()} />);
    const estado = screen.getByRole("status");
    expect(estado).toHaveTextContent(/primer check dado por elena soto \(administradora\) el/i);
    expect(estado).not.toHaveTextContent(/30799436/);
    expect(screen.getByRole("button", { name: /dar check/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /devolver para corrección/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rechazar/i })).toBeInTheDocument();
  });

  it("sin acciones: aviso y ningún botón", () => {
    render(<AccionesRevision solicitud={solicitudFake()} acciones={[]} onHecho={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/no hay acciones disponibles/i)).toBeInTheDocument();
  });

  it("rechazar pide motivo y lo envía", async () => {
    const onHecho = vi.fn();
    render(<AccionesRevision solicitud={solicitudFake()} acciones={["rechazar"]} onHecho={onHecho} />);
    await userEvent.click(screen.getByRole("button", { name: /rechazar/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^rechazar$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/obligatorio/i);
    expect(rechazar).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/el motivo/i), "No coincide la cédula");
    await userEvent.click(screen.getByRole("button", { name: /^rechazar$/i }));
    await waitFor(() => expect(rechazar).toHaveBeenCalledWith(solicitudFake().id, "No coincide la cédula"));
    await waitFor(() => expect(onHecho).toHaveBeenCalled());
  });
});

describe("Retirar mi check", () => {
  const conCheck = solicitudFake({ estado: "PENDIENTE_SEGUNDO_CHECK", decisiones: [decisionFake()] });

  it("el diálogo exige una justificación válida, muestra el contador y, al confirmar, avisa y refresca", async () => {
    const onHecho = vi.fn();
    render(<AccionesRevision solicitud={conCheck} acciones={["retirar_check"]} onHecho={onHecho} />);
    await userEvent.click(screen.getByRole("button", { name: /retirar mi check/i }));
    expect(await screen.findByText(/0 de 500 caracteres/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^retirar check$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/obligatoria/i);
    await userEvent.type(screen.getByLabelText(/justificación/i), "muy corto");
    expect(screen.getByText(/9 de 500 caracteres/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^retirar check$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/al menos 5 palabras y 20 caracteres/i);
    expect(retirar).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText(/justificación/i));
    await userEvent.type(screen.getByLabelText(/justificación/i), "Di el check por error en otra solicitud");
    await userEvent.click(screen.getByRole("button", { name: /^retirar check$/i }));
    await waitFor(() => expect(retirar).toHaveBeenCalledWith(conCheck.id, "Di el check por error en otra solicitud"));
    await waitFor(() => expect(onHecho).toHaveBeenCalled());
    expect(toastOk).toHaveBeenCalledWith("Check retirado.");
  }, 30_000);

  it("rechaza HTML en la justificación", async () => {
    render(<AccionesRevision solicitud={conCheck} acciones={["retirar_check"]} onHecho={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /retirar mi check/i }));
    await userEvent.type(screen.getByLabelText(/justificación/i), "<b>retiro este check por error</b>");
    await userEvent.click(screen.getByRole("button", { name: /^retirar check$/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(retirar).not.toHaveBeenCalled();
  });
});

describe("DialogoDevolver", () => {
  it("exige el motivo y envía la casilla «requiere nueva foto»", async () => {
    const onConfirmar = vi.fn();
    render(<DialogoDevolver abierto pendiente={false} onCerrar={vi.fn()} onConfirmar={onConfirmar} />);
    await userEvent.click(screen.getByRole("button", { name: /^devolver$/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onConfirmar).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/motivo/i), "La foto está borrosa");
    await userEvent.click(screen.getByLabelText(/requiere una foto nueva/i));
    await userEvent.click(screen.getByRole("button", { name: /^devolver$/i }));
    await waitFor(() => expect(onConfirmar).toHaveBeenCalledWith("La foto está borrosa", true));
  });
  it("el campo del motivo no se puede redimensionar", () => {
    render(<DialogoDevolver abierto pendiente={false} onCerrar={vi.fn()} onConfirmar={vi.fn()} />);
    expect(screen.getByLabelText(/motivo/i)).toHaveClass("resize-none");
  });
});
