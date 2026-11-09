import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import {
  BeforeInstallPromptEvent,
  BotonInstalarApp,
  TEXTOS_INSTALAR_APP,
} from "./boton-instalar-app";

describe("BotonInstalarApp", () => {
  const originalUserAgent = window.navigator.userAgent;

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
      configurable: true,
    });
    // Por defecto no standalone
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: originalUserAgent,
      configurable: true,
    });
  });

  it("permanece oculto si la aplicación ya está en modo standalone", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("display-mode: standalone"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(<BotonInstalarApp />);
    expect(container.firstChild).toBeNull();
  });

  it("permanece oculto si el navegador no emite beforeinstallprompt y no es iOS", () => {
    const { container } = render(<BotonInstalarApp />);
    expect(container.firstChild).toBeNull();
  });

  it("se muestra cuando se dispara el evento beforeinstallprompt", () => {
    render(<BotonInstalarApp />);

    act(() => {
      const evento = new Event("beforeinstallprompt") as unknown as BeforeInstallPromptEvent;
      Object.assign(evento, {
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
        platforms: ["web"],
      });
      window.dispatchEvent(evento);
    });

    const boton = screen.getByRole("button", {
      name: TEXTOS_INSTALAR_APP.BOTON_TITULO,
    });
    expect(boton).toBeInTheDocument();
  });

  it("muestra la etiqueta de texto si la prop conTexto está activa", () => {
    render(<BotonInstalarApp conTexto />);

    act(() => {
      const evento = new Event("beforeinstallprompt") as unknown as BeforeInstallPromptEvent;
      Object.assign(evento, {
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
        platforms: ["web"],
      });
      window.dispatchEvent(evento);
    });

    expect(screen.getByText(TEXTOS_INSTALAR_APP.BOTON_LABEL)).toBeInTheDocument();
  });

  it("ejecuta prompt() al hacer clic y se oculta si la instalación es aceptada", async () => {
    render(<BotonInstalarApp />);

    const mockPrompt = vi.fn().mockResolvedValue(undefined);
    const mockUserChoice = Promise.resolve({
      outcome: "accepted" as const,
      platform: "web",
    });

    act(() => {
      const evento = new Event("beforeinstallprompt") as unknown as BeforeInstallPromptEvent;
      Object.assign(evento, {
        prompt: mockPrompt,
        userChoice: mockUserChoice,
        platforms: ["web"],
      });
      window.dispatchEvent(evento);
    });

    const boton = screen.getByRole("button", {
      name: TEXTOS_INSTALAR_APP.BOTON_TITULO,
    });

    await act(async () => {
      fireEvent.click(boton);
      await mockUserChoice;
    });

    expect(mockPrompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: TEXTOS_INSTALAR_APP.BOTON_TITULO })).toBeNull();
  });

  it("se oculta automáticamente cuando se dispara el evento appinstalled", () => {
    render(<BotonInstalarApp />);

    act(() => {
      const evento = new Event("beforeinstallprompt") as unknown as BeforeInstallPromptEvent;
      Object.assign(evento, {
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
        platforms: ["web"],
      });
      window.dispatchEvent(evento);
    });

    expect(
      screen.getByRole("button", { name: TEXTOS_INSTALAR_APP.BOTON_TITULO }),
    ).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(
      screen.queryByRole("button", { name: TEXTOS_INSTALAR_APP.BOTON_TITULO }),
    ).toBeNull();
  });

  it("renderiza el botón en iPhone y abre el diálogo con la instrucción «Compartir → Agregar a inicio»", () => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      configurable: true,
    });

    render(<BotonInstalarApp />);

    const boton = screen.getByRole("button", {
      name: TEXTOS_INSTALAR_APP.BOTON_TITULO,
    });
    expect(boton).toBeInTheDocument();

    fireEvent.click(boton);

    // Diálogo abierto con título y pasos
    expect(
      screen.getByRole("heading", { name: TEXTOS_INSTALAR_APP.IOS_DIALOGO_TITULO }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(TEXTOS_INSTALAR_APP.IOS_INSTRUCCION_RESUMEN)),
    ).toBeInTheDocument();
    expect(screen.getByText(TEXTOS_INSTALAR_APP.IOS_PASO_COMPARTIR)).toBeInTheDocument();
    expect(screen.getByText(TEXTOS_INSTALAR_APP.IOS_PASO_AGREGAR)).toBeInTheDocument();

    // Botón para cerrar
    const botonCerrar = screen.getByRole("button", {
      name: TEXTOS_INSTALAR_APP.BOTON_CERRAR,
    });
    fireEvent.click(botonCerrar);

    expect(
      screen.queryByRole("heading", { name: TEXTOS_INSTALAR_APP.IOS_DIALOGO_TITULO }),
    ).toBeNull();
  });
});
