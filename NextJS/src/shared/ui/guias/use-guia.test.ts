import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGuia } from "./use-guia";
import type { DefinicionGuia } from "./tipos-guia";

const mockConsultarGuiasVistasAction = vi.fn();
const mockMarcarGuiaVistaAction = vi.fn();

vi.mock("./guias-actions", () => ({
  consultarGuiasVistasAction: () => mockConsultarGuiasVistasAction(),
  marcarGuiaVistaAction: (id: string, ver: number) =>
    mockMarcarGuiaVistaAction(id, ver),
}));

const mockDrive = vi.fn();
const mockDestroy = vi.fn();
const mockIsLastStep = vi.fn().mockReturnValue(false);

let capturedDriverConfig: Record<string, unknown> = {};

vi.mock("driver.js", () => ({
  driver: (config: Record<string, unknown>) => {
    capturedDriverConfig = config;
    return {
      drive: mockDrive,
      destroy: mockDestroy,
      isLastStep: mockIsLastStep,
      isActive: () => true,
    };
  },
}));

const GUIA_PRUEBA: DefinicionGuia = {
  id: "guia_test",
  version: 1,
  titulo: "Guía de prueba",
  pasos: [
    {
      id: "paso-1",
      selector: "[data-guia-id='elemento-1']",
      titulo: "Paso Uno",
      descripcion: "Descripción uno",
    },
    {
      id: "paso-2",
      selector: "[data-guia-id='elemento-2']",
      titulo: "Paso Dos",
      descripcion: "Descripción dos",
    },
  ],
};

describe("useGuia hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
    capturedDriverConfig = {};
    mockConsultarGuiasVistasAction.mockResolvedValue({ ok: true, vistas: {} });
    mockMarcarGuiaVistaAction.mockResolvedValue({ ok: true });
  });

  it("inicializa en estado de carga y consulta las guías vistas", async () => {
    mockConsultarGuiasVistasAction.mockResolvedValueOnce({
      ok: true,
      vistas: { guia_test: 1 },
    });

    const { result } = renderHook(() =>
      useGuia({ guia: GUIA_PRUEBA, autoIniciar: false }),
    );

    expect(result.current.cargando).toBe(true);

    await waitFor(() => {
      expect(result.current.cargando).toBe(false);
    });

    expect(result.current.yaVista).toBe(true);
  });

  it("omite pasos cuyos selectores no están en el DOM", async () => {
    // Solo agregamos elemento-1 al DOM
    const el1 = document.createElement("div");
    el1.setAttribute("data-guia-id", "elemento-1");
    document.body.appendChild(el1);

    const { result } = renderHook(() =>
      useGuia({ guia: GUIA_PRUEBA, autoIniciar: false }),
    );

    await waitFor(() => {
      expect(result.current.cargando).toBe(false);
    });

    act(() => {
      result.current.iniciarGuia();
    });

    expect(mockDrive).toHaveBeenCalledTimes(1);
    const steps = capturedDriverConfig.steps as Array<{ element: string }>;
    expect(steps).toHaveLength(1);
    expect(steps[0].element).toBe("[data-guia-id='elemento-1']");
  });

  it("no arranca ni marca vista si no queda ningún elemento en pantalla", async () => {
    // DOM vacío: ningún elemento presente
    const { result } = renderHook(() =>
      useGuia({ guia: GUIA_PRUEBA, autoIniciar: false }),
    );

    await waitFor(() => {
      expect(result.current.cargando).toBe(false);
    });

    act(() => {
      result.current.iniciarGuia();
    });

    expect(mockDrive).not.toHaveBeenCalled();
    expect(mockMarcarGuiaVistaAction).not.toHaveBeenCalled();
    expect(result.current.activa).toBe(false);
  });

  it("marca como vista en el servidor cuando se completa el último paso", async () => {
    const el1 = document.createElement("div");
    el1.setAttribute("data-guia-id", "elemento-1");
    document.body.appendChild(el1);

    const { result } = renderHook(() =>
      useGuia({ guia: GUIA_PRUEBA, autoIniciar: false }),
    );

    await waitFor(() => {
      expect(result.current.cargando).toBe(false);
    });

    act(() => {
      result.current.iniciarGuia();
    });

    mockIsLastStep.mockReturnValue(true);

    act(() => {
      // Simular evento onDestroyStarted (último paso) y onDestroyed
      const onDestroyStarted = capturedDriverConfig.onDestroyStarted as () => void;
      const onDestroyed = capturedDriverConfig.onDestroyed as () => void;
      onDestroyStarted?.();
      onDestroyed?.();
    });

    expect(mockMarcarGuiaVistaAction).toHaveBeenCalledWith("guia_test", 1);
  });

  it("marca como vista en el servidor si el usuario la cierra voluntariamente", async () => {
    const el1 = document.createElement("div");
    el1.setAttribute("data-guia-id", "elemento-1");
    document.body.appendChild(el1);

    const { result } = renderHook(() =>
      useGuia({ guia: GUIA_PRUEBA, autoIniciar: false }),
    );

    await waitFor(() => {
      expect(result.current.cargando).toBe(false);
    });

    act(() => {
      result.current.iniciarGuia();
    });

    act(() => {
      const onCloseClick = capturedDriverConfig.onCloseClick as () => void;
      onCloseClick?.();
      const onDestroyed = capturedDriverConfig.onDestroyed as () => void;
      onDestroyed?.();
    });

    expect(mockMarcarGuiaVistaAction).toHaveBeenCalledWith("guia_test", 1);
  });

  it("no marca como vista si el usuario sale a mitad (desmontaje sin completar)", async () => {
    const el1 = document.createElement("div");
    el1.setAttribute("data-guia-id", "elemento-1");
    document.body.appendChild(el1);

    const { result, unmount } = renderHook(() =>
      useGuia({ guia: GUIA_PRUEBA, autoIniciar: false }),
    );

    await waitFor(() => {
      expect(result.current.cargando).toBe(false);
    });

    act(() => {
      result.current.iniciarGuia();
    });

    // Desmontar el hook sin invocar onDestroyStarted de último paso ni onCloseClick
    unmount();

    expect(mockDestroy).toHaveBeenCalled();
    expect(mockMarcarGuiaVistaAction).not.toHaveBeenCalled();
  });
});
