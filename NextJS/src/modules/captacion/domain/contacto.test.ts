import { describe, expect, it } from "vitest";
import { antiguedadRelativa, describirContacto } from "./contacto";

const AHORA = new Date("2026-11-24T12:00:00Z");
const hace = (ms: number) => new Date(AHORA.getTime() - ms).toISOString();
const H = 3_600_000;

describe("antigüedad del contacto pendiente", () => {
  it("la dice en lenguaje claro", () => {
    expect(antiguedadRelativa(hace(30_000), AHORA)).toBe("hace unos segundos");
    expect(antiguedadRelativa(hace(5 * 60_000), AHORA)).toBe("hace 5 minutos");
    expect(antiguedadRelativa(hace(H), AHORA)).toBe("hace 1 hora");
    expect(antiguedadRelativa(hace(30 * H), AHORA)).toBe("hace 1 día");
    expect(antiguedadRelativa(hace(50 * H), AHORA)).toBe("hace 2 días");
  });
  it("tolera fechas vacías, inválidas o futuras", () => {
    expect(antiguedadRelativa(null, AHORA)).toBe("");
    expect(antiguedadRelativa("no", AHORA)).toBe("");
    expect(antiguedadRelativa(hace(-H), AHORA)).toBe("hace unos segundos");
  });
});

describe("estado del contacto", () => {
  it("sin pendiente no muestra nada", () => {
    expect(describirContacto({ contactoPendiente: false, contactoPendienteDesde: null, contactoAtrasado: false }, AHORA)).toMatchObject({ pendiente: false, texto: "" });
  });
  it("pendiente al día", () => {
    const e = describirContacto({ contactoPendiente: true, contactoPendienteDesde: hace(5 * H), contactoAtrasado: false }, AHORA);
    expect(e).toMatchObject({ pendiente: true, atrasado: false, antiguedad: "hace 5 horas" });
    expect(e.texto).toBe("Por contactar desde hace 5 horas.");
  });
  it("atrasado usa la marca del servidor y lo advierte", () => {
    const e = describirContacto({ contactoPendiente: true, contactoPendienteDesde: hace(72 * H), contactoAtrasado: true }, AHORA);
    expect(e.atrasado).toBe(true);
    expect(e.texto).toMatch(/hace 3 días.*plazo/);
  });
});
