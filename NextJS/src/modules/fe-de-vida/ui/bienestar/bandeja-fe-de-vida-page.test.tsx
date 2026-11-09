import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { solicitudFake } from "../../domain/services/fixtures-fe-de-vida";
import type { ProcesoDTO, SolicitudDTO } from "../../application/dtos/fe-de-vida-dto";

const mockListarProcesos = vi.fn();
const mockListarBandeja = vi.fn();

function renderConSwr(ui: React.ReactElement) {
  return render(<SWRConfig value={{ provider: () => new Map() }}>{ui}</SWRConfig>);
}

vi.mock("next/navigation", () => ({
  usePathname: () => "/personal/fe-de-vida",
}));

vi.mock("../../infrastructure/actions/fe-de-vida-actions", () => ({
  listarProcesosAction: (...args: unknown[]) => mockListarProcesos(...args),
  listarBandejaAction: (...args: unknown[]) => mockListarBandeja(...args),
}));

import BandejaFeDeVidaPage from "./bandeja-fe-de-vida-page";

const PROCESO_ABIERTO: ProcesoDTO = {
  id: "proc-abierto-1",
  nombre: "Proceso 2026 Abierto",
  apertura: "2026-10-01T00:00:00Z",
  cierre: "2026-12-31T23:59:59Z",
  cierreReal: null,
  estado: "ABIERTO",
  tiposNomina: [],
  diasRecordatorio: [],
};

const PROCESO_CERRADO: ProcesoDTO = {
  id: "proc-cerrado-1",
  nombre: "Proceso 2025 Cerrado",
  apertura: "2025-10-01T00:00:00Z",
  cierre: "2025-12-31T23:59:59Z",
  cierreReal: "2025-12-31T23:59:59Z",
  estado: "CERRADO",
  tiposNomina: [],
  diasRecordatorio: [],
};

const SOLICITUD_ABIERTA: SolicitudDTO = solicitudFake({
  id: "sol-1",
  procesoId: "proc-abierto-1",
  cedula: "12345678",
  nombre: "Pasivo Uno",
  estado: "PENDIENTE_REVISION",
});

const SOLICITUD_CERRADA: SolicitudDTO = solicitudFake({
  id: "sol-2",
  procesoId: "proc-cerrado-1",
  cedula: "87654321",
  nombre: "Pasivo Dos",
  estado: "VALIDADA",
});

describe("BandejaFeDeVidaPage", () => {
  beforeEach(() => {
    mockListarProcesos.mockReset();
    mockListarBandeja.mockReset();
  });

  it("por defecto muestra solicitudes del proceso ABIERTO y el filtro proceso no incluye cerrados", async () => {
    mockListarProcesos.mockImplementation(async (f: { estado?: string }) => {
      if (f?.estado === "ABIERTO") {
        return { ok: true, datos: { count: 1, results: [PROCESO_ABIERTO] } };
      }
      return { ok: true, datos: { count: 0, results: [] } };
    });

    mockListarBandeja.mockResolvedValue({
      ok: true,
      datos: { count: 1, results: [SOLICITUD_ABIERTA] },
    });

    renderConSwr(<BandejaFeDeVidaPage />);

    expect(screen.getByText("Fe de vida del personal pasivo")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /proceso vigente/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /histórico/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Pasivo Uno")).toBeInTheDocument();
    });

    // En el select de procesos solo aparece la opción abierta
    const selectProceso = screen.getByLabelText(/^proceso$/i);
    expect(selectProceso).toHaveTextContent("Todos los procesos abiertos");
    expect(selectProceso).toHaveTextContent("Proceso 2026 Abierto");
    expect(selectProceso).not.toHaveTextContent("Proceso 2025 Cerrado");

    // Enlace abrir
    expect(screen.getByRole("link", { name: /abrir la fe de vida de pasivo uno/i })).toBeInTheDocument();
  });

  it("muestra estado vacío claro con enlace al histórico si no hay proceso abierto", async () => {
    mockListarProcesos.mockImplementation(async (f: { estado?: string }) => {
      if (f?.estado === "ABIERTO") {
        return { ok: true, datos: { count: 0, results: [] } };
      }
      return { ok: true, datos: { count: 0, results: [] } };
    });

    mockListarBandeja.mockResolvedValue({
      ok: true,
      datos: { count: 0, results: [] },
    });

    renderConSwr(<BandejaFeDeVidaPage />);

    await waitFor(() => {
      expect(screen.getByText("No hay un proceso de fe de vida abierto")).toBeInTheDocument();
    });

    const botonHistorico = screen.getByRole("button", { name: /ver histórico de procesos/i });
    expect(botonHistorico).toBeInTheDocument();
  });

  it("en la pestaña Histórico lista procesos cerrados con 'Ver detalle'", async () => {
    const user = userEvent.setup();

    mockListarProcesos.mockImplementation(async (f: { estado?: string }) => {
      if (f?.estado === "ABIERTO") {
        return { ok: true, datos: { count: 1, results: [PROCESO_ABIERTO] } };
      }
      if (f?.estado === "CERRADO") {
        return { ok: true, datos: { count: 1, results: [PROCESO_CERRADO] } };
      }
      return { ok: true, datos: { count: 0, results: [] } };
    });

    mockListarBandeja.mockImplementation(async (f: { historico?: boolean }) => {
      if (f?.historico) {
        return { ok: true, datos: { count: 1, results: [SOLICITUD_CERRADA] } };
      }
      return { ok: true, datos: { count: 1, results: [SOLICITUD_ABIERTA] } };
    });

    renderConSwr(<BandejaFeDeVidaPage />);

    await waitFor(() => {
      expect(screen.getByText("Pasivo Uno")).toBeInTheDocument();
    });

    // Cambiar a la pestaña Histórico
    const tabHistorico = screen.getByRole("tab", { name: /histórico/i });
    await user.click(tabHistorico);

    await waitFor(() => {
      expect(screen.getByText("Histórico de fe de vida")).toBeInTheDocument();
      expect(screen.getByText("Pasivo Dos")).toBeInTheDocument();
    });

    const selectProceso = screen.getByLabelText(/^proceso$/i);
    expect(selectProceso).toHaveTextContent("Todos los procesos cerrados");
    expect(selectProceso).toHaveTextContent("Proceso 2025 Cerrado");

    expect(screen.getByRole("link", { name: /ver detalle de la fe de vida de pasivo dos/i })).toBeInTheDocument();
  });

  it("muestra los botones de exportar Excel y PDF y lanza la exportación con los filtros", async () => {
    const user = userEvent.setup();
    mockListarProcesos.mockImplementation(async (f: { estado?: string }) => {
      if (f?.estado === "ABIERTO") {
        return { ok: true, datos: { count: 1, results: [PROCESO_ABIERTO] } };
      }
      return { ok: true, datos: { count: 0, results: [] } };
    });
    mockListarBandeja.mockResolvedValue({
      ok: true,
      datos: { count: 1, results: [SOLICITUD_ABIERTA] },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/octet-stream" }),
      blob: async () =>
        new Blob(["test"], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
    });
    vi.stubGlobal("fetch", mockFetch);
    window.URL.createObjectURL = vi.fn(() => "blob:test");
    window.URL.revokeObjectURL = vi.fn();

    renderConSwr(<BandejaFeDeVidaPage />);

    const botonExcel = screen.getByRole("button", { name: /exportar excel/i });
    const botonPdf = screen.getByRole("button", { name: /exportar pdf/i });
    expect(botonExcel).toBeInTheDocument();
    expect(botonPdf).toBeInTheDocument();

    await user.click(botonExcel);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/fe-de-vida/bandeja/exportar?formato=excel"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
