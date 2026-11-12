import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Radix Select llama `scrollIntoView`, que jsdom no implementa.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

import { ConsolaEmisionView } from "./consola-emision-view";
import { SolicitudesCarnetView } from "./solicitudes-carnet-view";

// Mocks de next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === "cedula" ? "" : null),
  }),
}));

// Mocks de Server Actions
vi.mock("../../infrastructure/actions/carnetizacion-actions", () => ({
  buscarPersonalCarnetAction: vi.fn().mockResolvedValue([
    {
      id: 1,
      cedula: "18456789",
      nombre_completo: "BOLÍVAR HERNÁNDEZ, JOSÉ FERNANDO",
      cargo: "Especialista en Seguridad de Telecomunicaciones",
      departamento: "Gerencia de Operaciones y Redes",
      codigo: "GATH-0042",
      correo: "jbolivar@conatel.gob.ve",
      telefono: "04121234567",
      total_solicitudes: 1,
      tiene_carnet: true,
      carnet_activo_emitido_en: "2026-11-01T10:00:00+00:00",
    },
  ]),
  getMotivosCarnetAction: vi.fn().mockResolvedValue([
    { id: 1, nombre: "EMISIÓN POR PRIMERA VEZ" },
    { id: 2, nombre: "RENOVACIÓN POR VENCIMIENTO" },
    { id: 3, nombre: "EXTRAVÍO O PÉRDIDA" },
  ]),
  getPlantillasCarnetAction: vi.fn().mockResolvedValue([
    { id: 1, nombre: "Plantilla Oficial Activos", imagenUrl: "", activo: true, creado: "" },
  ]),
  actualizarVistaPreviaAction: vi.fn().mockResolvedValue({
    success: true,
    vista_previa: "data:image/png;base64,mock",
  }),
  generarCarnetPdfAction: vi.fn().mockResolvedValue({
    success: true,
    data: "JVBERi0xLjQKJcTl8uXr...mock",
    message: "Generado",
  }),
}));

describe("Consola de Emisión Unificada (O51 - 2.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza la barra de búsqueda viva y el estado vacío inicial", () => {
    render(<ConsolaEmisionView />);

    expect(screen.getByText("Consola de Emisión de Credenciales")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Buscar por cédula, nombre o código/i)).toBeInTheDocument();
    expect(screen.getByText("Ningún titular seleccionado")).toBeInTheDocument();
  });

  it("permite alternar entre filtros rápidos", () => {
    render(<ConsolaEmisionView />);

    const btnActivos = screen.getByRole("button", { name: "Activos" });
    const btnPasivos = screen.getByRole("button", { name: /Pasivos/i });

    expect(btnActivos).toBeInTheDocument();
    expect(btnPasivos).toBeInTheDocument();

    fireEvent.click(btnPasivos);
    // Cambia el estado activo del filtro
    expect(btnPasivos).toBeInTheDocument();
  });

  it("permite escribir en el buscador universal", () => {
    render(<ConsolaEmisionView />);

    const input = screen.getByPlaceholderText(/Buscar por cédula, nombre o código/i);
    fireEvent.change(input, { target: { value: "18456789" } });

    expect(input).toHaveValue("18456789");
  });
});

describe("Bandeja Centralizada de Solicitudes de Carnet (O51 - 2.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza la bandeja con BarraFiltros, contador y tabla de solicitudes", () => {
    render(<SolicitudesCarnetView />);

    expect(screen.getByText("Bandeja de Solicitudes de Carnet")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Buscar por cédula o nombre del solicitante/i)).toBeInTheDocument();
    expect(screen.getByText(/BOLÍVAR HERNÁNDEZ, JOSÉ FERNANDO/i)).toBeInTheDocument();
    expect(screen.getByText(/RAMÍREZ, ODALIS/i)).toBeInTheDocument();
  });

  it("abre el modal de dictamen al pulsar Dictaminar", async () => {
    render(<SolicitudesCarnetView />);

    const btnsDictaminar = screen.getAllByRole("button", { name: /Dictaminar/i });
    expect(btnsDictaminar.length).toBeGreaterThan(0);

    fireEvent.click(btnsDictaminar[0]);

    await waitFor(() => {
      expect(screen.getByText("Dictamen de Solicitud de Credencial")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Aprobar y Emitir Carnet/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Rechazar Solicitud/i })).toBeInTheDocument();
    });
  });

  it("filtra las solicitudes según el texto ingresado en BarraFiltros", () => {
    render(<SolicitudesCarnetView />);

    const input = screen.getByPlaceholderText(/Buscar por cédula o nombre del solicitante/i);
    fireEvent.change(input, { target: { value: "Odalis" } });

    expect(screen.getByText(/RAMÍREZ, ODALIS/i)).toBeInTheDocument();
    expect(screen.queryByText(/BOLÍVAR HERNÁNDEZ, JOSÉ FERNANDO/i)).not.toBeInTheDocument();
  });
});

describe("T2: motivo de reemisión en la consola", () => {
  async function seleccionarTrabajador() {
    render(<ConsolaEmisionView />);
    const input = screen.getByPlaceholderText(/Buscar por cédula, nombre o código/i);
    fireEvent.change(input, { target: { value: "18456789" } });
    const resultado = await screen.findByText(
      /BOLÍVAR HERNÁNDEZ/i,
      {},
      { timeout: 3000 },
    );
    fireEvent.click(resultado);
    await screen.findByText(/Parámetros de Emisión Oficial/i);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("avisa del carnet vigente y exige el motivo antes de emitir", async () => {
    await seleccionarTrabajador();

    expect(
      await screen.findByText(/Ya tiene un carnet vigente emitido el/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/01\/11\/2026/)).toBeInTheDocument();

    const emitir = screen.getByRole("button", { name: /Emitir y Descargar PDF/i });
    expect(emitir).toBeDisabled();

    fireEvent.click(screen.getByRole("combobox", { name: /Motivo de la reemisión/i }));
    fireEvent.click(await screen.findByRole("option", { name: "Pérdida o robo" }));

    await waitFor(() => expect(emitir).toBeEnabled());
  });

  it("con «Otro» exige un detalle de 10 caracteres", async () => {
    await seleccionarTrabajador();

    fireEvent.click(screen.getByRole("combobox", { name: /Motivo de la reemisión/i }));
    fireEvent.click(await screen.findByRole("option", { name: "Otro" }));

    const detalle = screen.getByLabelText(/Detalle de la reemisión/i);
    const emitir = screen.getByRole("button", { name: /Emitir y Descargar PDF/i });

    fireEvent.change(detalle, { target: { value: "corto" } });
    expect(emitir).toBeDisabled();

    fireEvent.change(detalle, { target: { value: "Se dañó el carnet" } });
    await waitFor(() => expect(emitir).toBeEnabled());
  });

  it("maneja el 409 del backend mostrando el aviso", async () => {
    const acciones = await import("../../infrastructure/actions/carnetizacion-actions");
    vi.mocked(acciones.generarCarnetPdfAction).mockResolvedValueOnce({
      success: false,
      message: "El carnet sigue vigente: elija el motivo e intente de nuevo.",
      data: null,
      status: 409,
    });

    await seleccionarTrabajador();
    fireEvent.click(screen.getByRole("combobox", { name: /Motivo de la reemisión/i }));
    fireEvent.click(await screen.findByRole("option", { name: "Deterioro" }));

    const emitir = screen.getByRole("button", { name: /Emitir y Descargar PDF/i });
    await waitFor(() => expect(emitir).toBeEnabled());
    fireEvent.click(emitir);

    expect(
      await screen.findByText("El carnet sigue vigente: elija el motivo e intente de nuevo."),
    ).toBeInTheDocument();
  });
});
