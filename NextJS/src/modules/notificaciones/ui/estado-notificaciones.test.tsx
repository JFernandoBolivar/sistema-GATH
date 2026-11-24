import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import useSWR, { SWRConfig } from "swr";
import type { ReactNode } from "react";

const acciones = vi.hoisted(() => ({
  consultarEstadoAction: vi.fn(),
  listarNotificacionesAction: vi.fn(),
}));
vi.mock("../infrastructure/actions/notificaciones-actions", () => acciones);

const toasts = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

import { INTERVALO_SONDEO_MS, claveRecientes } from "./notificaciones-swr";
import { reiniciarSondeoNotificaciones, useEstadoNotificaciones } from "./estado-notificaciones";

const est = (noLeidas: number, ultima: string) => ({
  ok: true as const,
  mensaje: "",
  datos: { noLeidas, ultimaActualizacion: ultima, huella: `${noLeidas}|${ultima}` },
});

function Contador({ etiqueta }: { etiqueta: string }) {
  const { noLeidas } = useEstadoNotificaciones();
  return <span data-testid={etiqueta}>{noLeidas}</span>;
}

/** Lista cargada con la clave de la campana: cuenta las recargas completas. */
const cargaLista = vi.fn(async () => "lista");
function Lista() {
  useSWR(claveRecientes(), cargaLista, { revalidateOnFocus: false });
  return null;
}

function Envoltorio({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
      <Lista />
    </SWRConfig>
  );
}

function fijarVisibilidad(estado: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => estado });
}

const avanzar = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  reiniciarSondeoNotificaciones();
  cargaLista.mockClear();
  fijarVisibilidad("visible");
  acciones.consultarEstadoAction.mockResolvedValue(est(1, "t1"));
  acciones.listarNotificacionesAction.mockResolvedValue({
    ok: true,
    mensaje: "",
    datos: { total: 1, limite: 1, desplazamiento: 0, resultados: [{ titulo: "Ventana habilitada" }] },
  });
});

afterEach(() => {
  vi.useRealTimers();
  fijarVisibilidad("visible");
});

describe("useEstadoNotificaciones (sondeo H-5)", () => {
  it("un solo sondeo compartido: dos consumidores, una consulta por ciclo", async () => {
    render(
      <>
        <Contador etiqueta="a" />
        <Contador etiqueta="b" />
      </>,
      { wrapper: Envoltorio },
    );
    await avanzar(0);
    expect(screen.getByTestId("a").textContent).toBe("1");
    expect(screen.getByTestId("b").textContent).toBe("1");
    expect(acciones.consultarEstadoAction).toHaveBeenCalledTimes(1);
  });

  it("se pausa con la pestaña oculta y se reanuda al volver", async () => {
    render(<Contador etiqueta="a" />, { wrapper: Envoltorio });
    await avanzar(0);
    const base = acciones.consultarEstadoAction.mock.calls.length;

    fijarVisibilidad("hidden");
    await avanzar(INTERVALO_SONDEO_MS * 3);
    expect(acciones.consultarEstadoAction).toHaveBeenCalledTimes(base);

    fijarVisibilidad("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(acciones.consultarEstadoAction.mock.calls.length).toBeGreaterThan(base);
  });

  it("sondea cada ~15 s con la pestaña visible", async () => {
    render(<Contador etiqueta="a" />, { wrapper: Envoltorio });
    await avanzar(0);
    const base = acciones.consultarEstadoAction.mock.calls.length;
    await avanzar(INTERVALO_SONDEO_MS + 100);
    expect(acciones.consultarEstadoAction.mock.calls.length).toBe(base + 1);
  });

  it("solo recarga la lista y avisa cuando el estado cambia", async () => {
    render(<Contador etiqueta="a" />, { wrapper: Envoltorio });
    await avanzar(0);
    expect(cargaLista).toHaveBeenCalledTimes(1);
    // Mismo estado: ni recarga de la lista ni toast.
    await avanzar(INTERVALO_SONDEO_MS + 100);
    expect(cargaLista).toHaveBeenCalledTimes(1);
    expect(acciones.listarNotificacionesAction).not.toHaveBeenCalled();
    expect(toasts.info).not.toHaveBeenCalled();

    // Llega un aviso: se recarga y se muestra el toast con el título.
    acciones.consultarEstadoAction.mockResolvedValue(est(2, "t2"));
    await avanzar(INTERVALO_SONDEO_MS + 100);
    expect(screen.getByTestId("a").textContent).toBe("2");
    expect(cargaLista).toHaveBeenCalledTimes(2);
    expect(acciones.listarNotificacionesAction).toHaveBeenCalledWith({ leida: false, limite: 1 });
    expect(toasts.info).toHaveBeenCalledTimes(1);
    expect(toasts.info.mock.calls[0][0]).toBe("Ventana habilitada");

    // Se lee un aviso (baja el contador): no hay toast.
    acciones.consultarEstadoAction.mockResolvedValue(est(1, "t3"));
    await avanzar(INTERVALO_SONDEO_MS + 100);
    expect(toasts.info).toHaveBeenCalledTimes(1);
  });

  it("un cambio con dos consumidores avisa una sola vez", async () => {
    render(
      <>
        <Contador etiqueta="a" />
        <Contador etiqueta="b" />
      </>,
      { wrapper: Envoltorio },
    );
    await avanzar(0);
    acciones.consultarEstadoAction.mockResolvedValue(est(3, "t2"));
    await avanzar(INTERVALO_SONDEO_MS + 100);
    expect(toasts.info).toHaveBeenCalledTimes(1);
  });
});
