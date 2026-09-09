import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AuthController, IDLE_TIMEOUT, GRACE_PERIOD } from "./auth-timer";

// El aviso debe aparecer GRACE_PERIOD antes de que se cumplan los
// IDLE_TIMEOUT minutos de inactividad, para que el cierre real de sesion
// ocurra exactamente a los IDLE_TIMEOUT minutos (no IDLE_TIMEOUT + GRACE_PERIOD).
const WARNING_AT = IDLE_TIMEOUT - GRACE_PERIOD;

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const logoutActionMock = vi.fn(async () => {});
const extendSessionActionMock = vi.fn(async () => ({ success: true }));
vi.mock("#/actions/auth-actions", () => ({
  logoutAction: () => logoutActionMock(),
  extendSessionAction: () => extendSessionActionMock(),
}));
vi.mock("#/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));
vi.mock("@/lib/api-client", () => ({
  ensureValidAccessToken: vi.fn(async () => true),
}));

let mockSession: { user: { id: string } } | null = {
  user: { id: "1" },
};
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: mockSession }),
}));

describe("AuthController (idle session timeout)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pushMock.mockClear();
    logoutActionMock.mockClear();
    extendSessionActionMock.mockClear();
    mockSession = { user: { id: "1" } };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not show the warning modal before (IDLE_TIMEOUT - GRACE_PERIOD) of inactivity", () => {
    render(<AuthController />);
    act(() => {
      vi.advanceTimersByTime(WARNING_AT - 1000);
    });
    expect(
      screen.queryByText(/tu sesión está por cerrarse/i),
    ).not.toBeInTheDocument();
  });

  it("shows the warning modal with both actions exactly GRACE_PERIOD before the 15-minute mark", () => {
    render(<AuthController />);
    act(() => {
      vi.advanceTimersByTime(WARNING_AT);
    });
    expect(screen.getByText(/tu sesión está por cerrarse/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /permanecer en la sesión/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cerrar sesión/i }),
    ).toBeInTheDocument();
  });

  it("auto-logs out exactly at the IDLE_TIMEOUT mark if the user does not respond", async () => {
    render(<AuthController />);
    act(() => {
      vi.advanceTimersByTime(WARNING_AT);
    });
    expect(screen.getByText(/tu sesión está por cerrarse/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GRACE_PERIOD);
    });

    expect(logoutActionMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/login");
    // El modal no debe seguir visible tras el cierre automatico de sesion.
    expect(
      screen.queryByText(/tu sesión está por cerrarse/i),
    ).not.toBeInTheDocument();
  });

  it('extends the session and refreshes the token when clicking "Permanecer en la sesión"', async () => {
    render(<AuthController />);
    act(() => {
      vi.advanceTimersByTime(WARNING_AT);
    });
    const stayButton = screen.getByRole("button", {
      name: /permanecer en la sesión/i,
    });

    await act(async () => {
      fireEvent.click(stayButton);
      await Promise.resolve();
    });

    expect(extendSessionActionMock).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText(/tu sesión está por cerrarse/i),
    ).not.toBeInTheDocument();
    expect(logoutActionMock).not.toHaveBeenCalled();

    // Tras "permanecer", el ciclo completo debe reiniciarse desde cero.
    act(() => {
      vi.advanceTimersByTime(WARNING_AT - 1000);
    });
    expect(
      screen.queryByText(/tu sesión está por cerrarse/i),
    ).not.toBeInTheDocument();
  });

  it('logs out immediately when clicking "Cerrar sesión"', async () => {
    render(<AuthController />);
    act(() => {
      vi.advanceTimersByTime(WARNING_AT);
    });
    const closeButton = screen.getByRole("button", { name: /^cerrar sesión$/i });

    await act(async () => {
      fireEvent.click(closeButton);
      await Promise.resolve();
    });

    expect(logoutActionMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  it("resets the countdown on real user activity (mousemove) before the warning would show", () => {
    render(<AuthController />);
    act(() => {
      vi.advanceTimersByTime(WARNING_AT - 1000);
    });
    // Actividad justo antes de que aparezca el aviso: debe reiniciar el conteo.
    act(() => {
      fireEvent.mouseMove(document);
    });
    act(() => {
      vi.advanceTimersByTime(WARNING_AT - 1000);
    });
    expect(
      screen.queryByText(/tu sesión está por cerrarse/i),
    ).not.toBeInTheDocument();
  });

  it("does not render anything when there is no active session", () => {
    mockSession = null;
    const { container } = render(<AuthController />);
    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT + GRACE_PERIOD);
    });
    expect(container).toBeEmptyDOMElement();
    expect(logoutActionMock).not.toHaveBeenCalled();
  });
});
