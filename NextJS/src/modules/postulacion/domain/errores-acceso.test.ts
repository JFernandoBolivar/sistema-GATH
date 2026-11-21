import { describe, expect, it } from "vitest";
import {
  codigoNextAuthDeAcceso,
  falloDeCodigoNextAuth,
  horaDeDesbloqueo,
  mensajeDeAcceso,
  presentarErrorApi,
} from "./errores-acceso";

describe("códigos de acceso", () => {
  it("conserva el código del backend y la hora de bloqueo", () => {
    expect(codigoNextAuthDeAcceso(401, "CREDENCIALES_INVALIDAS")).toBe("CREDENCIALES_INVALIDAS");
    expect(codigoNextAuthDeAcceso(429, "CREDENCIAL_BLOQUEADA", "2026-11-21T18:30:00+00:00")).toBe(
      "CREDENCIAL_BLOQUEADA|2026-11-21T18:30:00+00:00",
    );
    expect(codigoNextAuthDeAcceso(403, "CREDENCIAL_VENCIDA")).toBe("CREDENCIAL_VENCIDA");
    expect(codigoNextAuthDeAcceso(403, "ACCESO_NO_DISPONIBLE")).toBe("ACCESO_NO_DISPONIBLE");
  });

  it("sin código del backend deduce por el estado HTTP", () => {
    expect(codigoNextAuthDeAcceso(429, undefined)).toBe("CREDENCIAL_BLOQUEADA");
    expect(codigoNextAuthDeAcceso(401, "otro")).toBe("CREDENCIALES_INVALIDAS");
    expect(codigoNextAuthDeAcceso(500, undefined)).toBe("SERVICIO_NO_DISPONIBLE");
  });

  it("recupera el fallo desde el código de NextAuth (ida y vuelta)", () => {
    const codigo = codigoNextAuthDeAcceso(429, "CREDENCIAL_BLOQUEADA", "2026-11-21T18:30:00+00:00");
    expect(falloDeCodigoNextAuth(codigo)).toEqual({
      codigo: "CREDENCIAL_BLOQUEADA",
      bloqueadaHasta: "2026-11-21T18:30:00+00:00",
    });
    expect(falloDeCodigoNextAuth("CREDENCIAL_VENCIDA")).toEqual({ codigo: "CREDENCIAL_VENCIDA" });
  });

  it("un código desconocido (p. ej. el genérico de NextAuth) se trata como credenciales inválidas", () => {
    expect(falloDeCodigoNextAuth("credentials")).toEqual({ codigo: "CREDENCIALES_INVALIDAS" });
    expect(falloDeCodigoNextAuth(undefined)).toEqual({ codigo: "CREDENCIALES_INVALIDAS" });
  });
});

describe("mensajes", () => {
  it("credenciales inválidas es genérico: no menciona si la cédula existe", () => {
    const m = mensajeDeAcceso({ codigo: "CREDENCIALES_INVALIDAS" });
    expect(m).toMatch(/cédula o la contraseña/i);
    expect(m).not.toMatch(/no está registrada|no existe/i);
  });

  it("bloqueada indica la hora HH:MM de Venezuela", () => {
    // 18:30 UTC = 14:30 en Caracas (UTC-4).
    expect(horaDeDesbloqueo("2026-11-21T18:30:00+00:00")).toBe("14:30");
    expect(mensajeDeAcceso({ codigo: "CREDENCIAL_BLOQUEADA", bloqueadaHasta: "2026-11-21T18:30:00+00:00" })).toContain(
      "14:30",
    );
  });

  it("bloqueada sin hora interpretable usa un texto general", () => {
    expect(horaDeDesbloqueo("no-es-fecha")).toBeNull();
    expect(mensajeDeAcceso({ codigo: "CREDENCIAL_BLOQUEADA" })).toMatch(/bloqueado/i);
  });

  it("vencida remite a Captación", () => {
    expect(mensajeDeAcceso({ codigo: "CREDENCIAL_VENCIDA" })).toMatch(/venci/i);
    expect(mensajeDeAcceso({ codigo: "CREDENCIAL_VENCIDA" })).toMatch(/Captación/);
  });
});

describe("presentarErrorApi", () => {
  const base = { mensajeServidor: "msg", conErroresDeCampo: false };

  it("SESION_INVALIDA y 401 sin código marcan la sesión como caída", () => {
    expect(presentarErrorApi({ ...base, status: 401, codigo: "SESION_INVALIDA" }).sesionCaida).toBe(true);
    expect(presentarErrorApi({ ...base, status: 401 }).sesionCaida).toBe(true);
  });

  it("una clave actual incorrecta (401 con campo) no tira la sesión y conserva el texto del servidor", () => {
    const r = presentarErrorApi({
      status: 401,
      codigo: "CREDENCIALES_INVALIDAS",
      mensajeServidor: "La contraseña actual no es correcta.",
      conErroresDeCampo: true,
    });
    expect(r).toEqual({ mensaje: "La contraseña actual no es correcta.", sesionCaida: false });
  });

  it("CAMBIO_CLAVE_OBLIGATORIO y fallos de red tienen texto propio", () => {
    expect(presentarErrorApi({ ...base, status: 403, codigo: "CAMBIO_CLAVE_OBLIGATORIO" }).mensaje).toMatch(/cambiar/i);
    expect(presentarErrorApi({ ...base, status: 0, codigo: "SERVICIO_NO_DISPONIBLE" }).mensaje).toMatch(/conectar/i);
  });

  it("errores de negocio devuelven el mensaje del servidor", () => {
    expect(presentarErrorApi({ ...base, status: 409, mensajeServidor: "El expediente está cerrado." }).mensaje).toBe(
      "El expediente está cerrado.",
    );
  });
});
