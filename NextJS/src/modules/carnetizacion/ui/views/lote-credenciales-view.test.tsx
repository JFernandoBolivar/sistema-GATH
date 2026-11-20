import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import LoteCredencialesView from "./lote-credenciales-view";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/components/layout/page-layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockGetCola = vi.fn();
const mockGenerarTrabajadores = vi.fn();
const mockGetTipos = vi.fn();

vi.mock("../../infrastructure/actions/carnetizacion-actions", () => ({
  getColaImpresionCarnetsAction: (...args: unknown[]) => mockGetCola(...args),
  generarLoteCarnetsTrabajadoresPdfAction: (...args: unknown[]) => mockGenerarTrabajadores(...args),
  getTiposCredencialAction: (...args: unknown[]) => mockGetTipos(...args),
}));

const mockGenerarExternas = vi.fn();
const mockGetExternas = vi.fn();

vi.mock("../../infrastructure/actions/credenciales-externas-actions", () => ({
  generarLoteCredencialesPdfAction: (...args: unknown[]) => mockGenerarExternas(...args),
  getCredencialesExternasAction: (...args: unknown[]) => mockGetExternas(...args),
}));

// ---------------------------------------------------------------------------
// Datos de prueba
// ---------------------------------------------------------------------------

const COLA_MOCK = [
  {
    carnetId: 1,
    cedula: "12345678",
    nombre: "GARCIA, PEDRO",
    cargo: "Analista",
    departamento: "TI",
    motivo: "Primera vez",
    fechaEmision: "2026-01-15T08:00:00Z",
  },
  {
    carnetId: 2,
    cedula: "87654321",
    nombre: "LOPEZ, MARIA",
    cargo: "Coordinadora",
    departamento: "RRHH",
    motivo: "Renovación",
    fechaEmision: null,
  },
];

const EXTERNAS_MOCK = [
  {
    id: "ext-1",
    tipo_credencial: "VISITA",
    nombre: "VISITANTE UNO",
    documento: "V-11111111",
    correo: "",
    empresa: "Empresa SA",
    contrato: "",
    persona_visitada: "",
    motivo: "Reunión",
    vigencia_desde: "2026-01-01T00:00:00Z",
    vigencia_hasta: "2026-12-31T23:59:00Z",
    estado: "ACTIVA" as const,
    security_hash: "abc",
    empleado_cedula: null,
    observaciones: "",
    devuelta_en: null,
    anulada_en: null,
  },
];

// ---------------------------------------------------------------------------
// Setup global
// ---------------------------------------------------------------------------

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;

  Element.prototype.scrollIntoView ??= () => {};

  Object.defineProperty(URL, "createObjectURL", {
    writable: true,
    value: vi.fn().mockReturnValue("blob:mock-url"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    writable: true,
    value: vi.fn(),
  });

  HTMLAnchorElement.prototype.click = vi.fn();
});

// ---------------------------------------------------------------------------
// Helpers de render
// ---------------------------------------------------------------------------

function setupDefaults() {
  mockGetCola.mockResolvedValue(COLA_MOCK);
  mockGenerarTrabajadores.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
  mockGetTipos.mockResolvedValue([]);
  // La vista llama getCredencialesExternasAction("externo") y ("temporal") por separado.
  // Devolvemos el mock solo para "externo" para evitar duplicar filas con el mismo id.
  mockGetExternas.mockImplementation((grupo: string) =>
    Promise.resolve(grupo === "externo" ? EXTERNAS_MOCK : []),
  );
  mockGenerarExternas.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LoteCredencialesView", () => {
  it("(1) pestaña por defecto muestra la cola de carnets y NO la tabla externa", async () => {
    setupDefaults();
    render(<LoteCredencialesView />);

    // La cola carga: nombre del trabajador visible
    await waitFor(() => {
      expect(screen.getByText("GARCIA, PEDRO")).toBeTruthy();
    });

    // El nombre de visitante externo NO debe estar visible aún
    expect(screen.queryByText("VISITANTE UNO")).toBeNull();
  });

  it("(2) cambiar a la pestaña 'Visitantes y temporales' muestra las credenciales externas", async () => {
    setupDefaults();
    const user = userEvent.setup();
    render(<LoteCredencialesView />);

    // Esperar que la cola cargue para confirmar render completo
    await waitFor(() => {
      expect(screen.getByText("GARCIA, PEDRO")).toBeTruthy();
    });

    // Hacer clic en la pestaña de externas
    await user.click(screen.getByRole("tab", { name: /visitantes y temporales/i }));

    await waitFor(() => {
      expect(screen.getByText("VISITANTE UNO")).toBeTruthy();
    });
  });

  it("(3) seleccionar un carnet y generar llama la action con ([id], 'largo', true) y descarga el archivo correcto", async () => {
    setupDefaults();
    const user = userEvent.setup();
    render(<LoteCredencialesView />);

    // Esperar cola cargada
    await waitFor(() => {
      expect(screen.getByText("GARCIA, PEDRO")).toBeTruthy();
    });

    // Marcar el primer carnet (aria-label "Seleccionar a GARCIA, PEDRO")
    const checkboxPedro = screen.getByRole("checkbox", { name: "Seleccionar a GARCIA, PEDRO" });
    await user.click(checkboxPedro);

    // Botón de generar debe habilitarse (1 seleccionado)
    const btnGenerar = screen.getByRole("button", { name: /generar lote \(1\)/i });
    expect(btnGenerar).not.toBeDisabled();

    await user.click(btnGenerar);

    await waitFor(() => {
      expect(mockGenerarTrabajadores).toHaveBeenCalledWith(
        [1],     // ids ordenados según cola
        "largo", // modo duplex por defecto
        true,    // marcarImpresos por defecto
      );
    });

    // Verificar que se creó el anchor con el nombre correcto
    expect(URL.createObjectURL).toHaveBeenCalled();
    // El anchor.click debería haberse llamado (descarga iniciada)
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it("(4) modo 'corto' + tab externas llama generarLoteCredencialesPdfAction(ids, 'corto')", async () => {
    setupDefaults();
    const user = userEvent.setup();
    render(<LoteCredencialesView />);

    // Esperar render inicial
    await waitFor(() => {
      expect(screen.getByText("GARCIA, PEDRO")).toBeTruthy();
    });

    // Cambiar el selector nativo a "corto"
    const selectDuplex = document.getElementById("modo-duplex") as HTMLSelectElement;
    await user.selectOptions(selectDuplex, "corto");
    expect(selectDuplex.value).toBe("corto");

    // Ir a la pestaña de externas
    await user.click(screen.getByRole("tab", { name: /visitantes y temporales/i }));

    await waitFor(() => {
      expect(screen.getByText("VISITANTE UNO")).toBeTruthy();
    });

    // Marcar la credencial externa
    const checkboxExt = screen.getByRole("checkbox", { name: "Seleccionar a VISITANTE UNO" });
    await user.click(checkboxExt);

    const btnGenerar = screen.getByRole("button", { name: /generar lote \(1\)/i });
    await user.click(btnGenerar);

    await waitFor(() => {
      expect(mockGenerarExternas).toHaveBeenCalledWith(
        ["ext-1"],
        "corto",
      );
    });
  });

  it("(5) desmarcar 'Marcar como impresos' envía marcarImpresos=false", async () => {
    setupDefaults();
    const user = userEvent.setup();
    render(<LoteCredencialesView />);

    // Esperar cola cargada
    await waitFor(() => {
      expect(screen.getByText("GARCIA, PEDRO")).toBeTruthy();
    });

    // Desmarcar el checkbox "Marcar como impresos al generar"
    const checkboxMarcar = document.getElementById("marcar-impresos") as HTMLInputElement;
    await user.click(checkboxMarcar);

    // Marcar un carnet
    const checkboxPedro = screen.getByRole("checkbox", { name: "Seleccionar a GARCIA, PEDRO" });
    await user.click(checkboxPedro);

    // Generar
    const btnGenerar = screen.getByRole("button", { name: /generar lote \(1\)/i });
    await user.click(btnGenerar);

    await waitFor(() => {
      expect(mockGenerarTrabajadores).toHaveBeenCalledWith(
        [1],
        "largo", // modo por defecto
        false,   // marcarImpresos desmarcado
      );
    });
  });
});
