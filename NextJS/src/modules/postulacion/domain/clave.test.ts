import { describe, expect, it } from "vitest";
import { clavesCoinciden, evaluarClaveNueva } from "./clave";

const ctx = { cedula: "18123456", claveActual: "Temporal2026" };

function cumple(nueva: string, id: string): boolean {
  return evaluarClaveNueva(nueva, ctx).reglas.find((r) => r.id === id)!.cumple;
}

describe("evaluarClaveNueva", () => {
  it("acepta una clave de 10+ con letras y números, sin cédula y distinta de la actual", () => {
    expect(evaluarClaveNueva("MiClave2026x", ctx).valida).toBe(true);
  });

  it("exige 10 caracteres como mínimo", () => {
    expect(cumple("Abc12345", "longitud")).toBe(false);
    expect(cumple("Abcd123456", "longitud")).toBe(true);
  });

  it("exige letras y números", () => {
    expect(cumple("1234567890", "letra")).toBe(false);
    expect(cumple("abcdefghij", "numero")).toBe(false);
    expect(evaluarClaveNueva("abcdefghij", ctx).valida).toBe(false);
    expect(evaluarClaveNueva("1234567890", ctx).valida).toBe(false);
  });

  it("no puede contener la cédula", () => {
    expect(cumple("Hola18123456x", "sin_cedula")).toBe(false);
    expect(evaluarClaveNueva("Hola18123456x", ctx).valida).toBe(false);
  });

  it("debe ser distinta de la actual", () => {
    expect(cumple("Temporal2026", "distinta")).toBe(false);
    expect(evaluarClaveNueva("Temporal2026", ctx).valida).toBe(false);
  });

  it("vacía no cumple ninguna regla de contenido", () => {
    const e = evaluarClaveNueva("", ctx);
    expect(e.valida).toBe(false);
    expect(e.reglas.every((r) => !r.cumple)).toBe(true);
  });
});

describe("clavesCoinciden", () => {
  it("compara y rechaza la confirmación vacía", () => {
    expect(clavesCoinciden("abc", "abc")).toBe(true);
    expect(clavesCoinciden("abc", "abd")).toBe(false);
    expect(clavesCoinciden("", "")).toBe(false);
  });
});
