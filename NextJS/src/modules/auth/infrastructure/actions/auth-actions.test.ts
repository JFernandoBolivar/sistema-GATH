import { describe, expect, it, vi, beforeEach } from "vitest";

const cookieStoreMap = new Map<string, { value: string; options?: Record<string, unknown> }>();
const mockCookieStore = {
  get: vi.fn((name: string) => {
    const entry = cookieStoreMap.get(name);
    return entry ? { name, value: entry.value } : undefined;
  }),
  set: vi.fn((name: string, value: string, options?: Record<string, unknown>) => {
    cookieStoreMap.set(name, { value, options });
  }),
  getAll: vi.fn(() => {
    return Array.from(cookieStoreMap.entries()).map(([name, entry]) => ({
      name,
      value: entry.value,
    }));
  }),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockImplementation(async () => mockCookieStore),
}));

vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {},
}));

const mockSignOut = vi.fn().mockResolvedValue(undefined);
const mockSignIn = vi.fn().mockResolvedValue(undefined);

vi.mock("#/auth", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  auth: vi.fn(),
}));

const mockEnsureValidAccessToken = vi.fn();
vi.mock("@/lib/api-client", () => ({
  ensureValidAccessToken: () => mockEnsureValidAccessToken(),
}));

vi.mock("@/shared/infrastructure/logging/logger-server", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../application/use-cases/cerrar-sesion", () => ({
  cerrarSesion: vi.fn().mockResolvedValue(undefined),
}));

import { extenderSesionAction, cerrarSesionAction, limpiarCookiesAuthAction } from "./auth-actions";

describe("auth-actions (Ciclo de vida de sesión y extensión de tokens)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStoreMap.clear();
  });

  it("extenderSesionAction retorna { success: true } cuando ensureValidAccessToken tiene éxito", async () => {
    mockEnsureValidAccessToken.mockResolvedValue(true);

    const result = await extenderSesionAction();
    expect(result).toEqual({ success: true });
    expect(mockEnsureValidAccessToken).toHaveBeenCalledTimes(1);
  });

  it("extenderSesionAction retorna { success: false } cuando ensureValidAccessToken falla", async () => {
    mockEnsureValidAccessToken.mockResolvedValue(false);

    const result = await extenderSesionAction();
    expect(result).toEqual({ success: false });
  });

  it("cerrarSesionAction limpia cookies dj_*, cookies NextAuth y llama signOut", async () => {
    cookieStoreMap.set("dj_access", { value: "token" });
    cookieStoreMap.set("dj_refresh", { value: "refresh" });
    cookieStoreMap.set("authjs.session-token", { value: "session-xyz" });

    const res = await cerrarSesionAction();

    expect(res).toEqual({ success: true });
    expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "dj_access",
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "dj_refresh",
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
  });

  it("limpiarCookiesAuthAction elimina cookies sin llamar a signOut", async () => {
    cookieStoreMap.set("dj_access", { value: "token" });
    cookieStoreMap.set("next-auth.session-token", { value: "token" });

    const res = await limpiarCookiesAuthAction();

    expect(res).toEqual({ success: true });
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "dj_access",
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
  });
});
