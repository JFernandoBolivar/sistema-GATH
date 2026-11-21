import { describe, expect, it, vi } from "vitest";

import { rutaTrasSesionTerminada } from "./acceso-ruta";

describe("rutaTrasSesionTerminada", () => {
  it("el postulante vuelve a su acceso con el aviso de sesión terminada", () => {
    expect(rutaTrasSesionTerminada("POSTULANTE")).toBe("/postulacion/acceso?motivo=sesion");
  });

  it("el empleado o una sesión sin rol conocido van al login del personal", () => {
    expect(rutaTrasSesionTerminada("ADMINISTRADOR")).toBe("/login");
    expect(rutaTrasSesionTerminada(undefined)).toBe("/login");
    expect(rutaTrasSesionTerminada(null)).toBe("/login");
    expect(rutaTrasSesionTerminada("")).toBe("/login");
  });
});

const redirect = vi.hoisted(() =>
  vi.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));

describe("redirecciones por sesión vencida en el servidor", () => {
  it("handleSessionExpired respeta el rol que llevaba la sesión", async () => {
    const { handleSessionExpired } = await import("@/shared/infrastructure/http/errors");
    const { AuthSessionExpiredError } = await import("@/lib/auth-errors");
    expect(() => handleSessionExpired(new AuthSessionExpiredError("POSTULANTE"))).toThrow(
      "NEXT_REDIRECT:/postulacion/acceso?motivo=sesion",
    );
    expect(() => handleSessionExpired(new AuthSessionExpiredError("RRHH"))).toThrow("NEXT_REDIRECT:/login");
    expect(() => handleSessionExpired(new AuthSessionExpiredError())).toThrow("NEXT_REDIRECT:/login");
  });

  it("safeAction redirige igual que handleSessionExpired", async () => {
    const { safeAction } = await import("@/lib/action-utils");
    const { AuthSessionExpiredError } = await import("@/lib/auth-errors");
    const accion = safeAction(async (): Promise<Record<string, unknown>> => {
      throw new AuthSessionExpiredError("POSTULANTE");
    });
    await expect(accion()).rejects.toThrow("NEXT_REDIRECT:/postulacion/acceso?motivo=sesion");
  });
});
