import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { EstadisticasDTO } from "../../application/dtos/fe-de-vida-dto";

const mockEstadisticas = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { permisos: ["fe_de_vida.ver_estadisticas"], cedula: "1" } } }),
}));
vi.mock("../../infrastructure/actions/fe-de-vida-actions", () => ({
  obtenerEstadisticasAction: (...args: unknown[]) => mockEstadisticas(...args),
  listarPasivosEstadisticaAction: vi.fn(),
}));
vi.mock("./graficos-estadisticas", () => ({
  GraficoTipos: () => <div data-testid="grafico-tipos" />,
  GraficoEstados: () => <div data-testid="grafico-estados" />,
  GraficoDonut: () => <div data-testid="grafico-donut" />,
}));

import EstadisticasPage from "./estadisticas-page";

const BASE: EstadisticasDTO = {
  proceso: {
    id: "p1", nombre: "Fe de vida 2026", estado: "ABIERTO",
    apertura: "2026-09-01T00:00:00Z", cierre: "2026-12-31T00:00:00Z",
  },
  procesos: [{ id: "p1", nombre: "Fe de vida 2026", estado: "ABIERTO", apertura: null, cierre: null }],
  tipos: [{ id: 1, nombre: "JUBILADO" }],
  kpis: {
    total: 10, respondieron: 6, faltan: 4, validadas: 3,
    porcentajeRespondieron: 60, porcentajeFaltan: 40, porcentajeValidadas: 30,
  },
  porTipo: [{ tipoNominaId: 1, tipoNomina: "JUBILADO", total: 10, respondieron: 6, faltan: 4, validadas: 3 }],
  porEstado: [{ estado: "VALIDADA", total: 3 }, { estado: "PENDIENTE_REVISION", total: 3 }],
  porCanal: [{ canal: "EN_LINEA", total: 4 }, { canal: "PRESENCIAL", total: 2 }],
  matriz: [{ tipoNominaId: 1, tipoNomina: "JUBILADO", estado: "VALIDADA", total: 3 }],
  filtros: { procesoId: null, tipoNominaId: null, estado: null, canal: null, desde: null, hasta: null },
};

function renderPagina() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <EstadisticasPage />
    </SWRConfig>,
  );
}

describe("EstadisticasPage", () => {
  beforeEach(() => mockEstadisticas.mockReset());

  it("muestra los KPI, la matriz y el canal", async () => {
    mockEstadisticas.mockResolvedValue({ ok: true, datos: BASE });
    renderPagina();
    expect(await screen.findByText("Pasivos obligados")).toBeInTheDocument();
    expect(screen.getByText("60.0 % del total")).toBeInTheDocument();
    expect(screen.getByText("40.0 % · sin envío (incluye borradores)")).toBeInTheDocument();
    expect(screen.getByText("Matriz tipo de pasivo × estado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Validada · JUBILADO: 3 pasivos/i })).toBeInTheDocument();
    expect(screen.getAllByText("Presencial").length).toBeGreaterThan(0);
    expect(screen.getByTestId("grafico-donut")).toBeInTheDocument();
  });

  it("explica cómo consultar un proceso cuando no hay uno vigente", async () => {
    mockEstadisticas.mockResolvedValue({
      ok: true,
      datos: { ...BASE, proceso: null, procesos: [] },
    });
    renderPagina();
    expect(await screen.findByText("No hay un proceso abierto")).toBeInTheDocument();
    expect(screen.getByText(/Elija un proceso del histórico/)).toBeInTheDocument();
  });

  it("muestra el error con opción de reintentar", async () => {
    mockEstadisticas.mockResolvedValue({ ok: false, mensaje: "Sin permiso para estadísticas." });
    renderPagina();
    expect(await screen.findByText("Sin permiso para estadísticas.")).toBeInTheDocument();
  });
});
