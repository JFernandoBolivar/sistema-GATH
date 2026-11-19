import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";

const listar = vi.fn();
const extender = vi.fn();
const conceder = vi.fn();

vi.mock("../../infrastructure/actions/fe-de-vida-actions", () => ({
  listarProrrogasAction: (...a: unknown[]) => listar(...a),
  extenderProrrogaAction: (...a: unknown[]) => extender(...a),
  prorrogarProcesoAction: (...a: unknown[]) => conceder(...a),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { DialogoProrrogas } from "./dialogo-prorrogas";

const proceso = {
  id: "p1",
  nombre: "Fe de vida 2026",
  estado: "CERRADO" as const,
  apertura: "2026-11-01T00:00:00Z",
  cierre: "2026-11-18T00:00:00Z",
  cierreReal: "2026-11-18T00:00:00Z",
  tiposNomina: [],
  diasRecordatorio: [],
  prorrogas: { total: 2, vigentes: 1, generalVigente: true, individualesVigentes: 0, hasta: "2026-11-29T22:05:00Z" },
};

const vigente = {
  id: "pr2", procesoId: "p1", cedula: "", general: true, nuevaFechaLimite: "2026-11-29T22:05:00Z",
  motivo: "Extensión general", concedidaPor: "20000002", estado: "VIGENTE" as const,
  reemplazadaPor: null, reemplazadaEn: null,
};
const reemplazada = {
  id: "pr1", procesoId: "p1", cedula: "", general: true, nuevaFechaLimite: "2026-11-25T22:05:00Z",
  motivo: "Primera prórroga", concedidaPor: "20000002", estado: "REEMPLAZADA" as const,
  reemplazadaPor: "pr2", reemplazadaEn: "2026-11-19T10:00:00Z",
};

function renderDialogo() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <DialogoProrrogas proceso={proceso} onCerrar={vi.fn()} />
    </SWRConfig>,
  );
}

describe("DialogoProrrogas", () => {
  beforeEach(() => {
    listar.mockReset().mockResolvedValue({ ok: true, mensaje: "", datos: [vigente, reemplazada] });
    extender.mockReset().mockResolvedValue({ ok: true, mensaje: "Prórroga extendida.", datos: vigente });
    conceder.mockReset();
  });

  it("muestra la vigente con Extender y la anterior como reemplazada", async () => {
    renderDialogo();
    expect(await screen.findByText("Vigente")).toBeInTheDocument();
    expect(screen.getByText("Reemplazada")).toBeInTheDocument();
    expect(screen.getByText(/Reemplazada por una prórroga posterior/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Extender$/ })).toBeInTheDocument();
  });

  it("extiende la prórroga vigente con nueva fecha y motivo", async () => {
    renderDialogo();
    await userEvent.click(await screen.findByRole("button", { name: /^Extender$/ }));
    expect(screen.getByText(/La anterior quedará en el historial/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Nueva fecha límite/i, { selector: "#ext-fecha" }), {
      target: { value: "2026-12-01T10:00" },
    });
    await userEvent.type(
      screen.getByLabelText(/Motivo de la extensión/i),
      "Se amplía el plazo por solicitud de Bienestar.",
    );
    await userEvent.click(screen.getByRole("button", { name: /Extender prórroga/i }));
    await waitFor(() =>
      expect(extender).toHaveBeenCalledWith("p1", "pr2", {
        nuevaFechaLimite: "2026-12-01T10:00",
        motivo: "Se amplía el plazo por solicitud de Bienestar.",
      }),
    );
  });
});
