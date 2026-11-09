import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EstadisticasDTO } from "../../application/dtos/fe-de-vida-dto";
import { DialogoExportarEstadisticas } from "./dialogo-exportar-estadisticas";

const DATOS_MOCK: EstadisticasDTO = {
  proceso: {
    id: "proc-1",
    nombre: "Jornada Fe de Vida 2026",
    estado: "ABIERTO",
    apertura: "2026-01-01T00:00:00Z",
    cierre: "2026-03-31T23:59:59Z",
  },
  procesos: [{ id: "proc-1", nombre: "Jornada Fe de Vida 2026", estado: "ABIERTO", apertura: null, cierre: null }],
  tipos: [{ id: 1, nombre: "JUBILADOS" }],
  kpis: {
    total: 100,
    respondieron: 75,
    faltan: 25,
    validadas: 50,
    porcentajeRespondieron: 75,
    porcentajeFaltan: 25,
    porcentajeValidadas: 50,
  },
  porTipo: [{ tipoNominaId: 1, tipoNomina: "JUBILADOS", total: 100, respondieron: 75, faltan: 25, validadas: 50 }],
  porEstado: [{ estado: "VALIDADA", total: 50 }],
  porCanal: [{ canal: "EN_LINEA", total: 60 }],
  matriz: [{ tipoNominaId: 1, tipoNomina: "JUBILADOS", estado: "VALIDADA", total: 50 }],
  filtros: { procesoId: null, tipoNominaId: null, estado: null, canal: null, desde: null, hasta: null },
};

describe("DialogoExportarEstadisticas", () => {
  it("renderiza el diálogo con opciones de formato, contenido y vista previa", () => {
    render(
      <DialogoExportarEstadisticas
        abierto={true}
        alCerrar={vi.fn()}
        alConfirmar={vi.fn()}
        estadisticas={DATOS_MOCK}
        filtrosActivos={{}}
      />,
    );

    expect(screen.getByRole("heading", { name: /Generar reporte de estadísticas/i })).toBeInTheDocument();
    expect(screen.getByText("Documento PDF")).toBeInTheDocument();
    expect(screen.getByText("Libro Excel (.xlsx)")).toBeInTheDocument();
    expect(screen.getByText("Resumen e indicadores")).toBeInTheDocument();
    expect(screen.getByText(/Gráficos estadísticos \(solo PDF\)/i)).toBeInTheDocument();
    expect(screen.getByText("Listado de pasivos")).toBeInTheDocument();
    expect(screen.getByText(/Vista previa del reporte:/i)).toBeInTheDocument();
    expect(screen.getByText("Jornada Fe de Vida 2026")).toBeInTheDocument();
    expect(screen.getByText("25 registro(s)")).toBeInTheDocument();
  });

  it("permite cambiar a Excel y desactiva la opción de gráficos", async () => {
    render(
      <DialogoExportarEstadisticas
        abierto={true}
        alCerrar={vi.fn()}
        alConfirmar={vi.fn()}
        estadisticas={DATOS_MOCK}
        filtrosActivos={{}}
      />,
    );

    const radioExcel = screen.getByLabelText(/Libro Excel/i);
    fireEvent.click(radioExcel);

    expect(screen.getByText(/Generar reporte EXCEL/i)).toBeInTheDocument();
    const checkboxGraficos = screen.getByLabelText(/Gráficos estadísticos/i);
    expect(checkboxGraficos).toBeDisabled();
  });

  it("envía las opciones configuradas al confirmar y cierra", async () => {
    const alConfirmar = vi.fn().mockResolvedValue(undefined);
    const alCerrar = vi.fn();

    render(
      <DialogoExportarEstadisticas
        abierto={true}
        alCerrar={alCerrar}
        alConfirmar={alConfirmar}
        estadisticas={DATOS_MOCK}
        filtrosActivos={{}}
      />,
    );

    // Cambiar alcance a "Respondieron"
    const radioRespondieron = screen.getByLabelText("Respondieron");
    fireEvent.click(radioRespondieron);

    const botonGenerar = screen.getByRole("button", { name: /Generar reporte PDF/i });
    fireEvent.click(botonGenerar);

    expect(alConfirmar).toHaveBeenCalledWith({
      formato: "pdf",
      incluirResumen: true,
      incluirGraficos: true,
      incluirListado: true,
      alcanceListado: "respondieron",
    });
  });

  it("desactiva el botón de generar si no hay ninguna sección seleccionada", async () => {
    render(
      <DialogoExportarEstadisticas
        abierto={true}
        alCerrar={vi.fn()}
        alConfirmar={vi.fn()}
        estadisticas={DATOS_MOCK}
        filtrosActivos={{}}
      />,
    );

    const checkResumen = screen.getByLabelText("Resumen e indicadores");
    const checkGraficos = screen.getByLabelText(/Gráficos estadísticos/i);
    const checkListado = screen.getByLabelText("Listado de pasivos");

    fireEvent.click(checkResumen);
    fireEvent.click(checkGraficos);
    fireEvent.click(checkListado);

    expect(screen.getByText(/Debe seleccionar al menos una sección/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generar reporte/i })).toBeDisabled();
  });
});

describe("DialogoExportarEstadisticas en teléfono", () => {
  it("apila las tarjetas de formato en una columna y las pasa a dos desde sm", () => {
    render(
      <DialogoExportarEstadisticas
        abierto={true}
        alCerrar={vi.fn()}
        alConfirmar={vi.fn()}
        estadisticas={DATOS_MOCK}
        filtrosActivos={{}}
      />,
    );
    const grupo = screen.getAllByRole("radiogroup")[0];
    expect(grupo.className).toContain("grid-cols-1");
    expect(grupo.className).toContain("sm:grid-cols-2");
    expect(grupo.className).toContain("min-w-0");
    expect(grupo.className).not.toMatch(/(^|\s)grid-cols-2/);
  });
});
