import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePdfBlobUrl } from "./use-pdf-blob-url";

/**
 * M4: la URL `blob:` del PDF debe revocarse al reemplazar el reporte, al limpiar
 * el formulario y al desmontarlo; si no, el navegador retiene el archivo.
 */
describe("usePdfBlobUrl", () => {
  const crear = vi.fn(() => "blob:reporte");
  const revocar = vi.fn();

  beforeEach(() => {
    crear.mockClear();
    revocar.mockClear();
    vi.stubGlobal("URL", { createObjectURL: crear, revokeObjectURL: revocar });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("crea la URL al fijar el PDF", () => {
    const { result } = renderHook(() => usePdfBlobUrl());

    act(() => result.current.fijar(new Blob(["pdf"])));

    expect(crear).toHaveBeenCalledTimes(1);
    expect(result.current.url).toBe("blob:reporte");
  });

  it("revoca la URL anterior al reemplazar el reporte (y no la nueva)", () => {
    crear.mockReturnValueOnce("blob:primero").mockReturnValueOnce("blob:segundo");
    const { result } = renderHook(() => usePdfBlobUrl());

    act(() => result.current.fijar(new Blob(["1"])));
    act(() => result.current.fijar(new Blob(["2"])));

    expect(revocar).toHaveBeenCalledTimes(1);
    expect(revocar).toHaveBeenCalledWith("blob:primero");
    expect(revocar).not.toHaveBeenCalledWith("blob:segundo");
    expect(result.current.url).toBe("blob:segundo");
  });

  it("revoca y olvida la URL al limpiar", () => {
    const { result } = renderHook(() => usePdfBlobUrl());

    act(() => result.current.fijar(new Blob(["pdf"])));
    act(() => result.current.limpiar());

    expect(revocar).toHaveBeenCalledWith("blob:reporte");
    expect(result.current.url).toBeUndefined();
  });

  it("revoca la URL al desmontar el formulario", () => {
    const { result, unmount } = renderHook(() => usePdfBlobUrl());

    act(() => result.current.fijar(new Blob(["pdf"])));
    unmount();

    expect(revocar).toHaveBeenCalledWith("blob:reporte");
  });
});
