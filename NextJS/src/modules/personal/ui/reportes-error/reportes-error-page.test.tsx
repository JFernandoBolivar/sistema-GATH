import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { ReporteErrorLaboralApiItem } from "../../infrastructure/http/personal-api";

const mockGet = vi.fn();
const mockAtender = vi.fn();

vi.mock("../../infrastructure/actions/personal-actions", () => ({
  getReportesErrorLaboralAction: (...args: unknown[]) => mockGet(...args),
  atenderReporteErrorLaboralAction: (...args: unknown[]) => mockAtender(...args),
}));

import { ReportesErrorLaboralPageView } from "./reportes-error-page";

const REPORTE: ReporteErrorLaboralApiItem = {
  id: "rep-1",
  trabajador_cedula: "11111111",
  trabajador_nombre: "Maria Gonzalez",
  dato: "oficina",
  descripcion: "Oficina desactualizada.",
  estado: "PENDIENTE",
  creado_el: "2026-11-02T10:00:00Z",
  actualizado_el: "2026-11-02T10:00:00Z",
};

function renderPagina() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ReportesErrorLaboralPageView />
    </SWRConfig>,
  );
}

describe("ReportesErrorLaboralPageView (FIX-QA3)", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockAtender.mockReset();
  });

  it("no rompe con la lista vacía y muestra el estado vacío útil", async () => {
    mockGet.mockResolvedValue([]);
    renderPagina();
    expect(await screen.findByText(/No se encontraron reportes/)).toBeInTheDocument();
  });

  it("muestra los reportes cuando la API devuelve datos", async () => {
    mockGet.mockResolvedValue([REPORTE]);
    renderPagina();
    expect(await screen.findByText("Maria Gonzalez")).toBeInTheDocument();
    expect(screen.getByText("Oficina desactualizada.")).toBeInTheDocument();
    expect(screen.getByText("C.I. 11111111")).toBeInTheDocument();
  });

  it("muestra un error amigable si la API falla", async () => {
    mockGet.mockRejectedValue(new Error("sin conexión"));
    renderPagina();
    expect(await screen.findByText(/No se pudieron cargar los reportes de error laboral/)).toBeInTheDocument();
  });
});
