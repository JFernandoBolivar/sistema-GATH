import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { decisionFake, solicitudFake } from "../../domain/services/fixtures-fe-de-vida";

let permisosSesion: string[] = [];
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { permisos: permisosSesion, cedula: "999" } } }),
}));
const devolver = vi.fn();
const rechazar = vi.fn();
vi.mock("../../infrastructure/actions/fe-de-vida-actions", () => ({
  registrarCheckAction: vi.fn().mockResolvedValue({ ok: true, mensaje: "ok", datos: {} }),
  aprobarDirectoAction: vi.fn().mockResolvedValue({ ok: true, mensaje: "ok", datos: {} }),
  devolverSolicitudAction: (...a: unknown[]) => devolver(...a),
  rechazarSolicitudAction: (...a: unknown[]) => rechazar(...a),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AccionesRevision } from "./acciones-revision";
import { DialogoDevolver } from "./dialogos-decision";

beforeEach(() => {
  devolver.mockReset().mockResolvedValue({ ok: true, mensaje: "Devuelta", datos: {} });
  rechazar.mockReset().mockResolvedValue({ ok: true, mensaje: "Rechazada", datos: {} });
});

describe("AccionesRevision: botones por permiso", () => {
  it("el analista ve check, devolver y rechazar, pero no la aprobación directa", () => {
    permisosSesion = ["fe_de_vida.revisar", "fe_de_vida.check_analista"];
    render(<AccionesRevision solicitud={solicitudFake()} onHecho={vi.fn()} />);
    expect(screen.getByRole("button", { name: /dar check/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /devolver para corrección/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rechazar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aprobación directa/i })).toBeNull();
  });
  it("la administradora ve la aprobación directa", () => {
    permisosSesion = ["fe_de_vida.revisar", "fe_de_vida.check_administradora", "fe_de_vida.aprobar_directo"];
    render(<AccionesRevision solicitud={solicitudFake()} onHecho={vi.fn()} />);
    expect(screen.getByRole("button", { name: /aprobación directa/i })).toBeInTheDocument();
  });
  it("solo lectura: sin botones de decisión", () => {
    permisosSesion = ["fe_de_vida.ver_panel"];
    render(<AccionesRevision solicitud={solicitudFake()} onHecho={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("muestra quién dio el primer check", () => {
    permisosSesion = ["fe_de_vida.check_administradora"];
    const s = solicitudFake({ estado: "PENDIENTE_SEGUNDO_CHECK", decisiones: [decisionFake({ actorCedula: "111" })] });
    render(<AccionesRevision solicitud={s} onHecho={vi.fn()} />);
    expect(screen.getByText(/primer check dado por la cédula 111/i)).toBeInTheDocument();
  });
  it("rechazar pide motivo y lo envía", async () => {
    permisosSesion = ["fe_de_vida.revisar"];
    const onHecho = vi.fn();
    render(<AccionesRevision solicitud={solicitudFake()} onHecho={onHecho} />);
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
