import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import FeDeVidaPasivoPage from "./fe-de-vida-pasivo-page";
import type { VigenteDTO } from "../../application/dtos/fe-de-vida-dto";

const mockObtenerVigenteAction = vi.fn();
const mockMarcarGuiaVistaAction = vi.fn();
const mockIniciarSolicitudAction = vi.fn();
const mockObtenerMiSolicitudAction = vi.fn();

vi.mock("../../infrastructure/actions/fe-de-vida-actions", () => ({
  obtenerVigenteAction: () => mockObtenerVigenteAction(),
  marcarGuiaVistaAction: (...args: unknown[]) => mockMarcarGuiaVistaAction(...args),
  iniciarSolicitudAction: () => mockIniciarSolicitudAction(),
  obtenerMiSolicitudAction: (...args: unknown[]) => mockObtenerMiSolicitudAction(...args),
}));

vi.mock("./formulario-fe-de-vida", () => ({
  FormularioFeDeVida: () => <div data-testid="formulario-mock">Formulario</div>,
}));

describe("FeDeVidaPasivoPage (Guía de 5 pasos O22)", () => {
  const procesoBase: VigenteDTO = {
    proceso: {
      id: "proc-1111-2222",
      nombre: "Jornada Fe de Vida 2026",
      estado: "ABIERTO",
      apertura: "2026-11-01T08:00:00Z",
      cierre: "2026-11-30T18:00:00Z",
      cierreReal: null,
      tiposNomina: [],
      diasRecordatorio: [7, 3, 1],
    },
    solicitud: null,
    puedeEnviar: true,
    guiaVista: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMarcarGuiaVistaAction.mockResolvedValue({ ok: true, datos: true });
  });

  const renderPage = () =>
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <FeDeVidaPasivoPage />
      </SWRConfig>,
    );

  it("abre sola la guía la primera vez cuando guiaVista es false y guarda en el servidor al cerrar", async () => {
    const user = userEvent.setup();
    mockObtenerVigenteAction.mockResolvedValue({
      ok: true,
      datos: { ...procesoBase, guiaVista: false },
    });

    renderPage();

    // La guía se abre automáticamente
    const panel = await screen.findByRole("dialog");
    expect(panel).toBeInTheDocument();
    expect(screen.getByText(/Ingreso a la plataforma/i)).toBeInTheDocument();

    // Al cerrar con el botón Entendido
    const botonEntendido = screen.getByRole("button", { name: /entendido/i });
    await user.click(botonEntendido);

    // Debe invocar marcarGuiaVistaAction en el servidor con el id del proceso
    expect(mockMarcarGuiaVistaAction).toHaveBeenCalledWith("proc-1111-2222");
  });

  it("NO abre sola la guía cuando el servidor indica que ya fue vista (guiaVista: true)", async () => {
    mockObtenerVigenteAction.mockResolvedValue({
      ok: true,
      datos: { ...procesoBase, guiaVista: true },
    });

    renderPage();

    await screen.findByText(/Jornada Fe de Vida 2026/i);
    // El diálogo no debe estar abierto
    expect(screen.queryByRole("dialog")).toBeNull();

    // No debe haber llamado a marcarGuiaVistaAction
    expect(mockMarcarGuiaVistaAction).not.toHaveBeenCalled();
  });

  it("permite abrir la guía voluntariamente usando el botón 'Ver guía' en la cabecera", async () => {
    const user = userEvent.setup();
    mockObtenerVigenteAction.mockResolvedValue({
      ok: true,
      datos: { ...procesoBase, guiaVista: true },
    });

    renderPage();

    await screen.findByText(/Jornada Fe de Vida 2026/i);
    const botonesGuia = screen.getAllByRole("button", { name: /ver guía/i });
    expect(botonesGuia.length).toBeGreaterThan(0);

    // Al presionar el botón de la cabecera
    await user.click(botonesGuia[0]);

    // El panel de la guía se abre
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
