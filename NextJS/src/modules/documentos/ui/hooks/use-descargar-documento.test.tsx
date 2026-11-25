import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDescargarDocumento } from "./use-descargar-documento";

const accionMock = vi.fn();
const guardarMock = vi.fn();
const fetchMock = vi.fn();
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("../../infrastructure/actions/documentos-actions", () => ({
  descargarDocumentoGeneradoAction: (...args: unknown[]) => accionMock(...args),
}));
vi.mock("@/shared/lib/exportaciones-asincronas", () => ({
  guardarArchivo: (...args: unknown[]) => guardarMock(...args),
}));

beforeEach(() => {
  accionMock.mockReset();
  guardarMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("useDescargarDocumento", () => {
  it("obtiene el Blob del proxy mismo origen y guarda el PDF", async () => {
    accionMock.mockResolvedValue({
      success: true,
      data: { url: "/api/documentos/generados/doc-1/archivo/", nombre: "constancia-doc-1.pdf" },
    });
    const blob = new Blob(["%PDF"], { type: "application/pdf" });
    fetchMock.mockResolvedValue(new Response(blob, { status: 200 }));
    const { result } = renderHook(() => useDescargarDocumento());

    await act(async () => {
      expect(await result.current.descargar("doc-1", "Constancia")).toBe(true);
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/documentos/generados/doc-1/archivo/", {
      credentials: "same-origin",
      cache: "no-store",
    });
    expect(guardarMock).toHaveBeenCalledWith(blob, "constancia-doc-1.pdf");
  });

  it("devuelve false y no guarda nada cuando el proxy responde con error", async () => {
    accionMock.mockResolvedValue({
      success: true,
      data: { url: "/api/documentos/generados/doc-1/archivo/", nombre: "constancia.pdf" },
    });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Sin permiso." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    }));
    const { result } = renderHook(() => useDescargarDocumento());

    await act(async () => {
      expect(await result.current.descargar("doc-1", "Constancia")).toBe(false);
    });
    expect(guardarMock).not.toHaveBeenCalled();
  });
});
