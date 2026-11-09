import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CargaMasivaPage } from "./carga-masiva-page";

// Mock de next-auth/react
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        name: "Analista QA",
        permisos: [
          "personal.carga_masiva",
          "pasivos.carga_masiva",
          "personal.carga_masiva_aplicar",
          "personal.carga_masiva_aprobar",
          "personal.carga_masiva_revertir",
        ],
      },
    },
    status: "authenticated",
  }),
}));

// Mock de Server Actions
vi.mock("../infrastructure/actions/carga-masiva-actions", () => {
  const resumenBase = {
    id: "c-100",
    archivo: "nomina_noviembre.xlsx",
    estado: "ANALIZADA",
    poblacion: "ACTIVOS",
    tipos: ["datos_personales", "cargo_asignacion"],
    filas_total: 15,
    filas_validas: 14,
    filas_error: 1,
    filas_confirmacion: 0,
    filas_confirmadas: 0,
    creada_en: "2026-11-06T10:00:00Z",
  };

  const movimiento = {
    tipo: "ACTIVO_A_PASIVO",
    condicion_actual: "ACTIVO",
    condicion_nueva: "PASIVO",
    fecha: "2026-06-30",
    motivo: "JUBILACION DE DERECHO",
    motivo_id: 1,
    tipo_nomina: "JUBILADO",
    tipo_nomina_id: 2,
    cargo_codigo: "",
    cargo_id: null,
    descripcion: "Pase a pasivo con fecha 2026-06-30 por «JUBILACION DE DERECHO» en la nómina JUBILADO.",
    faltantes: [],
    completo: true,
  };

  return {
    listarCargasAction: vi.fn().mockResolvedValue({
      success: true,
      data: [
        resumenBase,
        {
          ...resumenBase,
          id: "c-101",
          archivo: "familiares_lote.xlsx",
          estado: "APLICADA",
          poblacion: "PASIVOS",
          tipos: ["familiares"],
          filas_total: 8,
          filas_validas: 8,
          filas_error: 0,
          creada_en: "2026-11-05T14:30:00Z",
        },
      ],
    }),
    obtenerDetalleCargaAction: vi.fn().mockResolvedValue({
      success: true,
      data: {
        ...resumenBase,
        filas_total: 3,
        filas_validas: 2,
        filas_error: 1,
        filas_confirmacion: 1,
        filas_confirmadas: 0,
        filas: [
          {
            id: "f-1",
            tipo: "datos_personales",
            numero_fila: 5,
            estado: "NUEVO",
            detalle: "Trabajador nuevo sin registros previos.",
            datos: { cedula: "12345678", nombres: "JUAN" },
            aplicada: false,
            confirmada: false,
            confirmada_por_cedula: "",
            confirmada_en: null,
            movimiento: null,
            error_aplicacion: null,
          },
          {
            id: "f-2",
            tipo: "datos_personales",
            numero_fila: 6,
            estado: "REQUIERE_CONFIRMACION",
            detalle: "Cambio de condición ACTIVO → PASIVO.",
            datos: { cedula: "87654321", nombres: "PEDRO" },
            aplicada: false,
            confirmada: false,
            confirmada_por_cedula: "",
            confirmada_en: null,
            movimiento,
            error_aplicacion: null,
          },
          {
            id: "f-3",
            tipo: "datos_personales",
            numero_fila: 7,
            estado: "ERROR",
            detalle: "La cédula contiene caracteres no numéricos.",
            datos: { cedula: "ABC", nombres: "LUIS" },
            aplicada: false,
            confirmada: false,
            confirmada_por_cedula: "",
            confirmada_en: null,
            movimiento: null,
            error_aplicacion: null,
          },
        ],
      },
    }),
    confirmarFilasCargaAction: vi.fn().mockResolvedValue({ success: true }),
    aplicarCargaAction: vi.fn().mockResolvedValue({
      success: true,
      data: { ...resumenBase, estado: "APLICADA" },
    }),
    aprobarCargaAction: vi.fn().mockResolvedValue({ success: true }),
    rechazarCargaAction: vi.fn().mockResolvedValue({ success: true }),
    revertirCargaAction: vi.fn().mockResolvedValue({ success: true }),
  };
});

describe("CargaMasivaPage (O28-F3, FIX-CARGA1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el título principal y las pestañas del asistente e historial", () => {
    render(<CargaMasivaPage />);

    expect(screen.getByRole("heading", { name: /carga masiva de personal/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /asistente de carga/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /historial de cargas/i })).toBeInTheDocument();
  });

  it("el Paso 1 exige población y muestra los tipos de la población activa", () => {
    render(<CargaMasivaPage />);

    expect(screen.getByText(/paso 1: población, tipos y plantilla/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /activos/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /pasivos/i })).not.toBeChecked();
    expect(screen.getByText("Datos personales")).toBeInTheDocument();
    expect(screen.getByText("Cargo y asignación")).toBeInTheDocument();
    expect(screen.getByText("Familiares")).toBeInTheDocument();
    expect(screen.getByText("Campos Obligatorios")).toBeInTheDocument();
    expect(screen.getByText("Expediente Completo")).toBeInTheDocument();
  });

  it("al elegir Pasivos quita Cargo y asignación y conserva los demás tipos", async () => {
    const user = userEvent.setup();
    render(<CargaMasivaPage />);

    await user.click(screen.getByRole("radio", { name: /pasivos/i }));

    expect(screen.queryByText("Cargo y asignación")).not.toBeInTheDocument();
    expect(screen.getByText("Datos personales")).toBeInTheDocument();
    expect(screen.getByText("Familiares")).toBeInTheDocument();
  });

  it("permite avanzar al Paso 2 (Subida de archivo) y retroceder", async () => {
    const user = userEvent.setup();
    render(<CargaMasivaPage />);

    const botonAvanzar = screen.getByRole("button", { name: /ya tengo el archivo listo/i });
    await user.click(botonAvanzar);

    // Debe estar en el Paso 2
    expect(screen.getByText(/paso 2: subida y análisis previos/i)).toBeInTheDocument();
    expect(screen.getByText(/haga clic para seleccionar o arrastre el archivo aquí/i)).toBeInTheDocument();
    expect(screen.getByText(/población seleccionada:/i)).toBeInTheDocument();

    // Retroceder al Paso 1
    const botonAtras = screen.getByRole("button", { name: /atrás \(plantilla\)/i });
    await user.click(botonAtras);

    expect(screen.getByText(/paso 1: población, tipos y plantilla/i)).toBeInTheDocument();
  });

  it("muestra el historial con la población y la filtra", async () => {
    const user = userEvent.setup();
    render(<CargaMasivaPage />);

    const tabHistorial = screen.getByRole("tab", { name: /historial de cargas/i });
    await user.click(tabHistorial);

    await waitFor(() => {
      expect(screen.getByText("nomina_noviembre.xlsx")).toBeInTheDocument();
      expect(screen.getByText("familiares_lote.xlsx")).toBeInTheDocument();
    });

    // Columna y filtro de población
    expect(screen.getAllByText("Activos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pasivos").length).toBeGreaterThan(0);

    // Muestra badges de estado
    expect(screen.getByText(/analizada \(sin guardar\)/i)).toBeInTheDocument();
    expect(screen.getByText(/^aplicada$/i)).toBeInTheDocument();
  });
});
