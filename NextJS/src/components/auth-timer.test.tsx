import { render, screen, act, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("#/auth", () => ({
  signOut: vi.fn(),
  signIn: vi.fn(),
  auth: vi.fn(),
}));

const { mockCerrarSesionAction, mockExtenderSesionAction } = vi.hoisted(() => ({
  mockCerrarSesionAction: vi.fn().mockResolvedValue({ success: true }),
  mockExtenderSesionAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/modules/auth/infrastructure/actions/auth-actions", () => ({
  cerrarSesionAction: mockCerrarSesionAction,
  extenderSesionAction: mockExtenderSesionAction,
}));

import { useSession } from "next-auth/react";
import { AuthController, IDLE_TIMEOUT, GRACE_PERIOD } from "./auth-timer";

describe("AuthController (temporizador de inactividad de 15 minutos)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("define IDLE_TIMEOUT en 15 minutos y GRACE_PERIOD en 60 segundos", () => {
    expect(IDLE_TIMEOUT).toBe(15 * 60 * 1000);
    expect(GRACE_PERIOD).toBe(60 * 1000);
  });

  it("no muestra el diálogo si no hay sesión activa", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    });

    render(<AuthController />);
    expect(
      screen.queryByText(/Tu sesión está por cerrarse por inactividad/i)
    ).not.toBeInTheDocument();
  });

  it("muestra el diálogo de advertencia tras 14 minutos de inactividad", () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: { id: "1", name: "Test User" } as any,
        expires: "2099-01-01",
      },
      status: "authenticated",
      update: vi.fn(),
    });

    render(<AuthController />);

    // Antes de los 14 minutos no debe mostrarse
    act(() => {
      vi.advanceTimersByTime(14 * 60 * 1000 - 1000);
    });
    expect(
      screen.queryByText(/Tu sesión está por cerrarse por inactividad/i)
    ).not.toBeInTheDocument();

    // A los 14 minutos exactos (IDLE_TIMEOUT - GRACE_PERIOD) aparece
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(
      screen.getByText(/Tu sesión está por cerrarse por inactividad/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Permanecer en la sesión/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Cerrar sesión/i })
    ).toBeInTheDocument();
  });

  it("hace logout si transcurre el período de gracia de 60 segundos sin interacción", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: { id: "1", name: "Test User" } as any,
        expires: "2099-01-01",
      },
      status: "authenticated",
      update: vi.fn(),
    });

    render(<AuthController />);

    // Avanzar hasta que salte el diálogo (14 min)
    act(() => {
      vi.advanceTimersByTime(14 * 60 * 1000);
    });

    // Avanzar los 60 segundos de gracia
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });

    expect(mockCerrarSesionAction).toHaveBeenCalled();
  });

  it("al presionar 'Permanecer en la sesión' llama a extenderSesionAction y oculta el diálogo", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: { id: "1", name: "Test User" } as any,
        expires: "2099-01-01",
      },
      status: "authenticated",
      update: vi.fn(),
    });

    render(<AuthController />);

    // Disparar diálogo
    act(() => {
      vi.advanceTimersByTime(14 * 60 * 1000);
    });

    const extendBtn = screen.getByRole("button", {
      name: /Permanecer en la sesión/i,
    });

    await act(async () => {
      fireEvent.click(extendBtn);
    });

    expect(mockExtenderSesionAction).toHaveBeenCalled();
    expect(
      screen.queryByText(/Tu sesión está por cerrarse por inactividad/i)
    ).not.toBeInTheDocument();
  });
});
