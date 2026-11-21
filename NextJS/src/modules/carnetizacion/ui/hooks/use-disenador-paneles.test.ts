import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDisenadorPaneles } from "./use-disenador-paneles";

describe("useDisenadorPaneles", () => {
  it("el panel izquierdo empieza en «capas» y cambia al elegir otro", () => {
    const { result } = renderHook(() =>
      useDisenadorPaneles({ isMobile: false, setTabInspector: vi.fn() }),
    );
    expect(result.current.panelIzquierdo).toBe("capas");
    act(() => result.current.setPanelIzquierdo("agregar"));
    expect(result.current.panelIzquierdo).toBe("agregar");
    act(() => result.current.setPanelIzquierdo("fondo"));
    expect(result.current.panelIzquierdo).toBe("fondo");
  });

  it("en escritorio, al seleccionar se activa la pestaña Propiedades y no se abre el drawer", () => {
    const setTab = vi.fn();
    const { result } = renderHook(() =>
      useDisenadorPaneles({ isMobile: false, setTabInspector: setTab }),
    );
    act(() => result.current.mostrarPropiedades());
    expect(setTab).toHaveBeenCalledWith("propiedades");
    expect(result.current.panelMovil).toBeNull();
  });

  it("en móvil, al seleccionar se abre el panel de Propiedades (también al re-tocar)", () => {
    const { result } = renderHook(() =>
      useDisenadorPaneles({ isMobile: true, setTabInspector: vi.fn() }),
    );
    expect(result.current.panelMovil).toBeNull();
    act(() => result.current.mostrarPropiedades());
    expect(result.current.panelMovil).toBe("propiedades");
    act(() => result.current.setPanelMovil(null));
    act(() => result.current.mostrarPropiedades());
    expect(result.current.panelMovil).toBe("propiedades");
  });

  it("cruzar el breakpoint no abre el panel móvil por sí solo", () => {
    const { result, rerender } = renderHook(
      ({ isMobile }) => useDisenadorPaneles({ isMobile, setTabInspector: vi.fn() }),
      { initialProps: { isMobile: false } },
    );
    act(() => result.current.mostrarPropiedades());
    rerender({ isMobile: true });
    expect(result.current.panelMovil).toBeNull();
  });
});
