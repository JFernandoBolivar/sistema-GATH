import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const acciones = vi.hoisted(() => ({
  getEventoDetalleAction: vi.fn(),
  getPanelEventoAction: vi.fn(),
  getInvitadosEventoAction: vi.fn(),
  getCategoriasEventoAction: vi.fn(),
  getZonasEventoAction: vi.fn(),
  emitirCredencialesLoteAction: vi.fn(),
  crearCategoriaEventoAction: vi.fn(),
  crearZonaEventoAction: vi.fn(),
  checkInAccesoAction: vi.fn(),
  getEventosAction: vi.fn(),
}));

vi.mock("@/modules/carnetizacion/infrastructure/actions/eventos-actions", () => acciones);

import { EventoDetallePanel } from "./evento-detalle-panel";

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

describe("EventoDetallePanel - Hub Integral de Eventos", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    acciones.getEventoDetalleAction.mockResolvedValue({
      id: "ev-100",
      nombre: "Expo Fitelven 2026",
      lugar: "Poliedro de Caracas",
      fecha_inicio: "2026-11-15T08:00:00Z",
      fecha_fin: "2026-11-18T18:00:00Z",
      descripcion: "Exposición Internacional de Telecomunicaciones",
      estado: "activo",
    });

    acciones.getPanelEventoAction.mockResolvedValue({
      evento: {
        id: "ev-100",
        nombre: "Expo Fitelven 2026",
        lugar: "Poliedro de Caracas",
        fecha_inicio: "2026-11-15T08:00:00Z",
        fecha_fin: "2026-11-18T18:00:00Z",
        estado: "activo",
      },
      metricas: {
        total_invitados: 50,
        total_emitidos: 35,
        total_ingresos: 20,
        porcentaje_asistencia: 40,
        pendientes_ingreso: 30,
      },
      por_categoria: [
        { categoria_nombre: "VIP / Autoridad", total: 10, emitidos: 10, ingresaron: 8 },
        { categoria_nombre: "Prensa", total: 40, emitidos: 25, ingresaron: 12 },
      ],
      por_zona: [
        { zona_nombre: "Acceso Principal", codigo: "P-01", ingresaron: 20 },
      ],
    });

    acciones.getInvitadosEventoAction.mockResolvedValue([
      {
        id: "inv-1",
        evento_id: "ev-100",
        nombre_completo: "GONZÁLEZ PÉREZ, MARÍA ANDREÍNA",
        documento_identidad: "V-20123456",
        categoria_id: "cat-1",
        categoria_nombre: "VIP / Autoridad",
        zona_id: "zona-1",
        zona_nombre: "Acceso Principal",
        organizacion: "Ministerio del Poder Popular",
        codigo_credencial: "FIT-0001",
        estado: "emitido",
        fecha_emision: "2026-11-10T09:00:00Z",
        fecha_ingreso: null,
      },
      {
        id: "inv-2",
        evento_id: "ev-100",
        nombre_completo: "RAMÍREZ SÁNCHEZ, CARLOS LUIS",
        documento_identidad: "V-18765432",
        categoria_id: "cat-2",
        categoria_nombre: "Prensa",
        zona_id: "zona-1",
        zona_nombre: "Acceso Principal",
        organizacion: "Agencia Venezolana de Noticias",
        codigo_credencial: "FIT-0002",
        estado: "ingreso",
        fecha_emision: "2026-11-10T09:00:00Z",
        fecha_ingreso: "2026-11-15T08:30:00Z",
        hora_ingreso_formateada: "08:30 AM",
      },
    ]);

    acciones.getCategoriasEventoAction.mockResolvedValue([
      { id: "cat-1", evento_id: "ev-100", nombre: "VIP / Autoridad", color_primario: "#004085", color_acento: "#cce5ff", orden: 1 },
      { id: "cat-2", evento_id: "ev-100", nombre: "Prensa", color_primario: "#155724", color_acento: "#d4edda", orden: 2 },
    ]);

    acciones.getZonasEventoAction.mockResolvedValue([
      { id: "zona-1", evento_id: "ev-100", nombre: "Acceso Principal", codigo: "P-01", orden: 1 },
    ]);

    acciones.getEventosAction.mockResolvedValue([
      { id: "ev-100", nombre: "Expo Fitelven 2026" },
    ]);
  });

  it("renderiza el panel con las 5 pestañas canónicas y las métricas", async () => {
    render(<EventoDetallePanel eventoId="ev-100" />);

    expect(await screen.findByText("Expo Fitelven 2026")).toBeInTheDocument();
    expect(screen.getByText("Poliedro de Caracas")).toBeInTheDocument();

    // 5 Pestañas canónicas
    expect(screen.getByText("Resumen")).toBeInTheDocument();
    expect(screen.getByText(/Invitados \(\d+\)/)).toBeInTheDocument();
    expect(screen.getByText("Gafetes")).toBeInTheDocument();
    expect(screen.getByText("Control")).toBeInTheDocument();
    expect(screen.getByText("Configuración")).toBeInTheDocument();

    // Métricas en la pestaña Resumen
    expect(await screen.findByText("Invitados")).toBeInTheDocument();
    expect(screen.getByText("Credenciales emitidas")).toBeInTheDocument();
    expect(screen.getByText("Entraron")).toBeInTheDocument();
    expect(screen.getByText("Faltan")).toBeInTheDocument();
  });

  it("permite navegar a la pestaña Nómina de Invitados y buscar", async () => {
    render(<EventoDetallePanel eventoId="ev-100" />);

    expect(await screen.findByText("Expo Fitelven 2026")).toBeInTheDocument();

    const tabNomina = screen.getByRole("tab", { name: /Invitados/i });
    fireEvent.pointerDown(tabNomina, { button: 0, pointerType: "mouse" });
    fireEvent.click(tabNomina);
    fireEvent.keyDown(tabNomina, { key: "Enter" });

    expect(await screen.findByText("GONZÁLEZ PÉREZ, MARÍA ANDREÍNA")).toBeInTheDocument();
    expect(screen.getByText("RAMÍREZ SÁNCHEZ, CARLOS LUIS")).toBeInTheDocument();

    // Búsqueda rápida
    const inputBusqueda = screen.getByPlaceholderText(/Buscar por nombre, documento/i);
    fireEvent.change(inputBusqueda, { target: { value: "RAMÍREZ" } });

    expect(screen.getByText("RAMÍREZ SÁNCHEZ, CARLOS LUIS")).toBeInTheDocument();
    expect(screen.queryByText("GONZÁLEZ PÉREZ, MARÍA ANDREÍNA")).not.toBeInTheDocument();
  });

  it("permite seleccionar todos los resultados del filtro en Nómina y procesar en Emisión", async () => {
    render(<EventoDetallePanel eventoId="ev-100" />);

    expect(await screen.findByText("Expo Fitelven 2026")).toBeInTheDocument();

    // 1. Ir a Nómina
    const tabNomina = screen.getByRole("tab", { name: /Invitados/i });
    fireEvent.pointerDown(tabNomina, { button: 0, pointerType: "mouse" });
    fireEvent.click(tabNomina);
    fireEvent.keyDown(tabNomina, { key: "Enter" });

    // 2. Seleccionar todos los resultados del filtro
    expect(await screen.findByText(/Seleccionar todos los resultados del filtro/i)).toBeInTheDocument();
    const btnSeleccionarTodos = screen.getByText(/Seleccionar todos los resultados del filtro/i);
    fireEvent.click(btnSeleccionarTodos);

    expect(screen.getByText(/Seleccionados:/i)).toBeInTheDocument();

    // 3. Ir a Emisión de Gafetes
    const tabEmision = screen.getByRole("tab", { name: /Gafetes/i });
    fireEvent.pointerDown(tabEmision, { button: 0, pointerType: "mouse" });
    fireEvent.click(tabEmision);
    fireEvent.keyDown(tabEmision, { key: "Enter" });

    expect(await screen.findByText(/Emisión Masiva de Gafetes \(90 × 130 mm\)/i)).toBeInTheDocument();
    expect(screen.getByText(/2 asistente\(s\) seleccionado\(s\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Emitir Credenciales en Lote/i)).toBeInTheDocument();
    expect(screen.getByText(/Descargar PDF Completo/i)).toBeInTheDocument();
  });
});
