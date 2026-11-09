import { afterEach, describe, expect, it, vi } from "vitest";

import authConfig from "../auth.config";

vi.mock("next-auth", () => ({
  CredentialsSignin: class CredentialsSignin extends Error {},
}));
vi.mock("next-auth/providers/credentials", () => ({
  default: (config: unknown) => config,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: vi.fn() })),
}));

function respuesta(data: unknown) {
  return {
    ok: true,
    json: async () => ({ data }),
  } as Response;
}

describe("authorize", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lanza /me y /roles en paralelo y conserva los datos de sesión", async () => {
    const started: string[] = [];
    let resolverMe: (value: Response) => void = () => {};
    let resolverRoles: (value: Response) => void = () => {};
    const me = new Promise<Response>((resolve) => {
      resolverMe = resolve;
    });
    const roles = new Promise<Response>((resolve) => {
      resolverRoles = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/auth/login/")) {
          return Promise.resolve(
            respuesta({
              usuario: {
                id: 1,
                cedula: "12345678",
                nombres: "ANA",
                apellidos: "PEREZ",
                correo: "ana@conatel.gob.ve",
                telefono: "",
                rol_id: 3,
                is_active: true,
                debe_cambiar_password: false,
              },
              tokens: { access: "access", refresh: "refresh" },
            }),
          );
        }
        if (url.includes("/auth/me/")) {
          started.push("me");
          return me;
        }
        if (url.includes("/identidad/roles/")) {
          started.push("roles");
          return roles;
        }
        throw new Error(`fetch inesperado: ${url}`);
      }),
    );

    const authorize = authConfig.providers[0].authorize as (
      credentials: Record<string, unknown>,
      request: unknown,
    ) => Promise<Record<string, unknown> | null>;

    const pendiente = authorize(
      { email: "ana@conatel.gob.ve", password: "12345678" },
      {},
    );

    await vi.waitFor(() => expect([...started].sort()).toEqual(["me", "roles"]));

    resolverMe(
      respuesta({
        id: 1,
        cedula: "12345678",
        nombres: "ANA",
        apellidos: "PEREZ",
        correo: "ana@conatel.gob.ve",
        telefono: "",
        rol_id: 3,
        is_active: true,
        debe_cambiar_password: false,
        permisos: ["autogestion.ver_propio"],
        rol_nombre: "AUTOGESTION",
        condicion_trabajador: "ACTIVO",
      }),
    );
    resolverRoles(respuesta([{ id: 3, nombre_rol: "AUTOGESTION" }]));

    const usuario = await pendiente;
    expect(usuario?.permisos).toEqual(["autogestion.ver_propio"]);
    expect(usuario?.condicionTrabajador).toBe("ACTIVO");
    expect(usuario?.role).toEqual({
      id: 3,
      nombre_rol: "AUTOGESTION",
      nombre_visible: "AUTOGESTION",
    });
  });
});
