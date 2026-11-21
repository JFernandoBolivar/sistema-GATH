import { describe, expect, it, vi } from "vitest";

// `auth` envuelve el handler del proxy: en la prueba se usa el handler tal cual.
vi.mock("../auth", () => ({ auth: (handler: unknown) => handler }));

import proxy from "./proxy";

type Usuario = { role: { nombre_rol: string }; permisos: string[]; sesionPostulante?: { debeCambiarClave: boolean } };

function peticion(ruta: string, user?: Usuario) {
  return {
    nextUrl: new URL(`http://localhost:3000${ruta}`),
    headers: new Headers({ host: "localhost:3000" }),
    auth: user ? { user } : null,
  };
}

async function resultado(ruta: string, user?: Usuario) {
  const respuesta = (await (proxy as unknown as (r: unknown) => Promise<Response>)(peticion(ruta, user))) as Response;
  return { estado: respuesta.status, destino: respuesta.headers.get("location") ?? undefined };
}

const postulante = (debeCambiarClave = false): Usuario => ({
  role: { nombre_rol: "POSTULANTE" },
  permisos: [],
  sesionPostulante: { debeCambiarClave },
});
const empleado: Usuario = { role: { nombre_rol: "ADMINISTRADOR" }, permisos: ["*"] };

describe("proxy: área del postulante", () => {
  it("un postulante que pide una ruta del personal vuelve a /postulacion", async () => {
    const r = await resultado("/carnetizacion", postulante());
    expect(r.estado).toBe(307);
    expect(new URL(r.destino!).pathname).toBe("/postulacion");
  });

  it("un empleado no entra a /postulacion/*", async () => {
    const r = await resultado("/postulacion", empleado);
    expect(new URL(r.destino!).pathname).toBe("/dashboard");
  });

  it("con cambio de clave pendiente todo redirige a cambiar-clave", async () => {
    const r = await resultado("/postulacion", postulante(true));
    expect(new URL(r.destino!).pathname).toBe("/postulacion/cambiar-clave");
  });

  it("sin sesión, /postulacion va a acceso y acceso es pública", async () => {
    expect(new URL((await resultado("/postulacion")).destino!).pathname).toBe("/postulacion/acceso");
    const acceso = await resultado("/postulacion/acceso");
    expect(acceso.estado).toBe(200);
    expect(acceso.destino).toBeUndefined();
  });

  it("sin sesión, las rutas del personal siguen yendo a /login", async () => {
    expect(new URL((await resultado("/carnetizacion")).destino!).pathname).toBe("/login");
  });
});
