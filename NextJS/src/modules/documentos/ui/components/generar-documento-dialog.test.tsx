import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlantillaBajoDemanda } from "../../domain/entities/plantilla";
import { GenerarDocumentoDialog } from "./generar-documento-dialog";

const generarMock = vi.fn();
const descargarMock = vi.fn();
const guardarMock = vi.fn();
const fetchMock = vi.fn();
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("../../infrastructure/actions/documentos-actions", () => ({
  generarBajoDemandaAction: (...a: unknown[]) => generarMock(...a),
  descargarDocumentoGeneradoAction: (...a: unknown[]) => descargarMock(...a),
}));
vi.mock("@/shared/lib/exportaciones-asincronas", () => ({
  guardarArchivo: (...args: unknown[]) => guardarMock(...args),
}));

function plantilla(extra: Partial<PlantillaBajoDemanda> = {}): PlantillaBajoDemanda {
  return {
    id: "pl1",
    codigo: "CONSTANCIA",
    nombre: "Constancia de trabajo",
    descripcion: "Constancia para el trabajador.",
    modo: "formulario",
    proceso: "bajo_demanda",
    proceso_etiqueta: "Bajo demanda",
    firmante: "conatel",
    requiere_firma_clic: false,
    activa: true,
    estado: "publicada",
    ultima_version: 2,
    cambios_sin_publicar: false,
    tiene_fondo: false,
    actualizada_en: null,
    campos_propios: [
      { clave: "destino", etiqueta: "Dirigida a", tipo: "texto", obligatorio: true, ayuda: "" },
      { clave: "observaciones", etiqueta: "Observaciones", tipo: "texto_largo", obligatorio: false, ayuda: "" },
    ],
    ...extra,
  } as PlantillaBajoDemanda;
}

function montar(plantillas: PlantillaBajoDemanda[]) {
  const onGenerado = vi.fn();
  const onCerrar = vi.fn();
  render(
    <GenerarDocumentoDialog abierto onCerrar={onCerrar} trabajadorCedula="V12345678" plantillas={plantillas} onGenerado={onGenerado} />,
  );
  return { onGenerado, onCerrar };
}

beforeEach(() => {
  generarMock.mockReset();
  descargarMock.mockReset();
  guardarMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("GenerarDocumentoDialog", () => {
  it("sin plantillas publicadas y activas explica qué hacer", () => {
    montar([plantilla({ activa: false }), plantilla({ id: "b", ultima_version: 0, estado: "borrador" })]);
    expect(screen.getByTestId("sin-plantillas-bajo-demanda")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Generar y descargar/ })).not.toBeInTheDocument();
  });

  it("pide los campos propios, exige los obligatorios, genera y descarga el PDF", async () => {
    generarMock.mockResolvedValue({
      success: true,
      data: { id: "doc-1", plantilla_nombre: "Constancia de trabajo" },
    });
    descargarMock.mockResolvedValue({
      success: true,
      data: { url: "/api/documentos/generados/doc-1/archivo/", nombre: "constancia-doc-1.pdf" },
    });
    fetchMock.mockResolvedValue(new Response(new Blob(["%PDF"], { type: "application/pdf" }), { status: 200 }));
    const { onGenerado, onCerrar } = montar([plantilla()]);

    fireEvent.click(screen.getByRole("button", { name: /Generar y descargar/ }));
    expect(await screen.findByText("Este dato es obligatorio.")).toBeInTheDocument();
    expect(generarMock).not.toHaveBeenCalled();

    expect(screen.getByLabelText("Observaciones")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Dirigida a/), { target: { value: "Banco Provincial" } });
    fireEvent.change(screen.getByLabelText("Observaciones"), { target: { value: "Para trámite bancario" } });
    fireEvent.click(screen.getByRole("button", { name: /Generar y descargar/ }));

    await waitFor(() => expect(onGenerado).toHaveBeenCalled());
    expect(generarMock).toHaveBeenCalledWith({
      plantilla_id: "pl1",
      trabajador_cedula: "V12345678",
      valores_propios: { destino: "Banco Provincial", observaciones: "Para trámite bancario" },
    });
    expect(guardarMock).toHaveBeenCalledWith(expect.any(Blob), "constancia-doc-1.pdf");
    expect(onCerrar).toHaveBeenCalled();
  });

  it("conserva el documento generado si la descarga falla y permite reintentar", async () => {
    generarMock.mockResolvedValue({
      success: true,
      data: { id: "doc-1", plantilla_nombre: "Constancia de trabajo" },
    });
    descargarMock.mockResolvedValue({
      success: true,
      data: { url: "/api/documentos/generados/doc-1/archivo/", nombre: "constancia-doc-1.pdf" },
    });
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "No se pudo descargar." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(new Blob(["%PDF"], { type: "application/pdf" }), { status: 200 }));
    const { onGenerado, onCerrar } = montar([plantilla({ campos_propios: [] })]);

    fireEvent.click(screen.getByRole("button", { name: /Generar y descargar/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("El documento se generó, pero no se pudo descargar");
    expect(screen.getByText("Documento generado")).toBeInTheDocument();
    expect(onGenerado).toHaveBeenCalledTimes(1);
    expect(onCerrar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Descargar nuevamente" }));
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1));
    expect(guardarMock).toHaveBeenCalledWith(expect.any(Blob), "constancia-doc-1.pdf");
  });

  it("si el servidor rechaza, muestra el error y no descarga", async () => {
    generarMock.mockResolvedValue({ success: false, error: "No se pudo generar el documento." });
    const { onGenerado } = montar([plantilla({ campos_propios: [] })]);
    fireEvent.click(screen.getByRole("button", { name: /Generar y descargar/ }));
    await waitFor(() => expect(generarMock).toHaveBeenCalled());
    expect(descargarMock).not.toHaveBeenCalled();
    expect(onGenerado).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo generar el documento.");
  });
});
