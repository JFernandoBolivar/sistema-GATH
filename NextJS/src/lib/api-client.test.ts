import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthSessionExpiredError } from "./auth-errors";

// Mock de cookies de Next.js
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

vi.mock("#/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "30540767", name: "Admin Test", email: "admin@conatel.gob.ve" },
  }),
}));

// react cache mock para entorno de pruebas
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T>(fn: T) => fn,
  };
});

import { ensureValidAccessToken, refreshTokens, apiFetch } from "./api-client";

describe("api-client (Gestión de tokens por sesión y refresh token)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStoreMap.clear();
    // Reset global fetch
    vi.stubGlobal("fetch", vi.fn());
  });

  it("ensureValidAccessToken retorna true si ya existe un dj_access válido en cookies", async () => {
    cookieStoreMap.set("dj_access", { value: "valid-access-token" });

    const isValid = await ensureValidAccessToken();
    expect(isValid).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("si dj_access no existe, refreshTokens consume dj_refresh e invoca el endpoint de refresh", async () => {
    cookieStoreMap.set("dj_refresh", { value: "valid-refresh-token" });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "success",
        message: "Tokens renovados",
        data: {
          tokens: {
            access: "new-access-token-123",
            refresh: "new-rotated-refresh-456",
          },
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const token = await refreshTokens();

    expect(token).toBe("new-access-token-123");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("api/v1/identidad/auth/refresh/"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refresh: "valid-refresh-token" }),
      }),
    );

    // Debe haber fijado dj_access y dj_refresh con atributos HttpOnly
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "dj_access",
      "new-access-token-123",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        maxAge: 15 * 60,
        path: "/",
      }),
    );
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "dj_refresh",
      "new-rotated-refresh-456",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        maxAge: 8 * 60 * 60,
        path: "/",
      }),
    );
  });

  it("si dj_refresh no existe, refreshTokens retorna null y no llama al backend", async () => {
    const token = await refreshTokens();
    expect(token).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("si el endpoint de refresh responde con error (ej. 401), elimina las cookies de autenticación", async () => {
    cookieStoreMap.set("dj_refresh", { value: "expired-refresh-token" });
    cookieStoreMap.set("authjs.session-token", { value: "stale-session" });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Token inválido" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const token = await refreshTokens();

    expect(token).toBeNull();
    // Verifica que se haya limpiado dj_access y dj_refresh con maxAge: 0
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

  it("apiFetch adjunta Authorization Bearer y responde los datos del endpoint", async () => {
    cookieStoreMap.set("dj_access", { value: "access-token-abc" });

    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ status: "success", data: [{ id: 1, nombre: "Test" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const data = await apiFetch<unknown>("api/v1/personal/empleados/");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("api/v1/personal/empleados/"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token-abc",
        }),
      }),
    );
    expect(data).toEqual({ status: "success", data: [{ id: 1, nombre: "Test" }] });
  });

  it("apiFetch renueva el token y reintenta la petición si la llamada original recibe 401", async () => {
    cookieStoreMap.set("dj_access", { value: "expired-access-token" });
    cookieStoreMap.set("dj_refresh", { value: "valid-refresh-token" });

    let fetchCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
      fetchCount++;
      if (url.includes("api/v1/identidad/auth/refresh/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: { tokens: { access: "refreshed-token-xyz" } },
          }),
        };
      }

      // Primera llamada al recurso protegido retorna 401
      if (fetchCount === 1) {
        return {
          status: 401,
          json: async () => ({ detail: "Token expired" }),
        };
      }

      // Reintento exitoso con el nuevo token
      return {
        status: 200,
        json: async () => ({ status: "success", message: "Acceso concedido tras refresco" }),
      };
    });

    vi.stubGlobal("fetch", mockFetch);

    const result = await apiFetch<unknown>("api/v1/reportes/nomina/");

    expect(result).toEqual({ status: "success", message: "Acceso concedido tras refresco" });
    // Verificamos que el reintento se hizo con el nuevo token refrescado
    expect(mockFetch).toHaveBeenLastCalledWith(
      expect.stringContaining("api/v1/reportes/nomina/"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer refreshed-token-xyz",
        }),
      }),
    );
  });

  it("apiFetch lanza AuthSessionExpiredError si el 401 no se puede renovar", async () => {
    cookieStoreMap.set("dj_access", { value: "expired-access-token" });
    cookieStoreMap.set("dj_refresh", { value: "invalid-refresh-token" });

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api/v1/identidad/auth/refresh/")) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ detail: "Refresh token expired" }),
        };
      }
      return {
        status: 401,
        json: async () => ({ detail: "Unauthorized" }),
      };
    });

    vi.stubGlobal("fetch", mockFetch);

    await expect(apiFetch("api/v1/cargos/")).rejects.toThrow(AuthSessionExpiredError);
  });
});
