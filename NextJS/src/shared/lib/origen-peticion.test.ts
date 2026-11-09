import { describe, expect, it } from "vitest";

import { origenDeCabeceras, urlDePeticion } from "./origen-peticion";

function cabeceras(pares: Record<string, string>): Headers {
  return new Headers(pares);
}

describe("origenDeCabeceras", () => {
  it("prefiere x-forwarded-host y x-forwarded-proto del proxy", () => {
    const headers = cabeceras({
      host: "nextjs-App:3000",
      "x-forwarded-host": "gath.ejemplo.gob.ve",
      "x-forwarded-proto": "https",
    });
    expect(origenDeCabeceras(headers)).toBe("https://gath.ejemplo.gob.ve");
  });

  it("toma el primer valor cuando el proxy encadena varios hosts", () => {
    const headers = cabeceras({
      "x-forwarded-host": "gath.ejemplo.gob.ve, interno",
      "x-forwarded-proto": "https, http",
    });
    expect(origenDeCabeceras(headers)).toBe("https://gath.ejemplo.gob.ve");
  });

  it("usa host directo y https cuando no hay cabeceras de proxy", () => {
    expect(origenDeCabeceras(cabeceras({ host: "gath.ejemplo.gob.ve:8443" }))).toBe(
      "https://gath.ejemplo.gob.ve:8443",
    );
  });

  it("usa http para localhost y 127.0.0.1", () => {
    expect(origenDeCabeceras(cabeceras({ host: "localhost:3001" }))).toBe("http://localhost:3001");
    expect(origenDeCabeceras(cabeceras({ host: "127.0.0.1:3001" }))).toBe(
      "http://127.0.0.1:3001",
    );
    expect(origenDeCabeceras(cabeceras({ host: "[::1]:3001" }))).toBe("http://[::1]:3001");
  });

  it("ignora un protocolo inventado y lo deduce del host", () => {
    expect(
      origenDeCabeceras(cabeceras({ host: "gath.ejemplo.gob.ve", "x-forwarded-proto": "ftp" })),
    ).toBe("https://gath.ejemplo.gob.ve");
  });

  it("devuelve null si la petición no trae host", () => {
    expect(origenDeCabeceras(cabeceras({}))).toBeNull();
  });
});

describe("urlDePeticion", () => {
  it("resuelve la ruta contra el origen reenviado, no contra localhost", () => {
    const headers = cabeceras({
      host: "localhost:3001",
      "x-forwarded-host": "gath.ejemplo.gob.ve",
      "x-forwarded-proto": "https",
    });
    expect(urlDePeticion(headers, "/login")?.toString()).toBe(
      "https://gath.ejemplo.gob.ve/login",
    );
  });

  it("devuelve null sin origen", () => {
    expect(urlDePeticion(cabeceras({}), "/login")).toBeNull();
  });
});
