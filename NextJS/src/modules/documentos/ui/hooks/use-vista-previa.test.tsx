import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useVistaPrevia } from "./use-vista-previa";

const fetchMock = vi.fn();
const createObjectURLMock = vi.fn(() => "blob:vista-previa");

beforeEach(() => {
  fetchMock.mockReset();
  createObjectURLMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: createObjectURLMock,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(URL, "createObjectURL");
});

describe("useVistaPrevia", () => {
  it("envía el proceso no guardado junto con la definición y los campos propios", async () => {
    const payload = {
      proceso: "ingreso_ventana2",
      definicion: { pagina: { tamano: "carta", orientacion: "vertical" }, encabezado: { tipo: "institucional", titulo: "Documento", subtitulo: "" }, bloques: [] },
      campos_propios: [],
    };
    fetchMock.mockResolvedValue(new Response(new Blob(["%PDF"], { type: "application/pdf" }), { status: 200 }));
    const { result } = renderHook(() => useVistaPrevia({
      plantillaId: "pl1",
      payload,
      automatica: false,
    }));

    await act(async () => {
      await result.current.generar();
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/documentos/plantillas/pl1/vista-previa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(result.current.url).toBe("blob:vista-previa");
  });
});
