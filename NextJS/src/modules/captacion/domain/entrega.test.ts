import { describe, expect, it } from "vitest";
import { correoUtilizable, enmascararCorreo, entregaEfectiva } from "./entrega";

describe("enmascararCorreo", () => {
  it.each([
    ["juan.perez@gmail.com", "ju***@gmail.com"],
    ["a@x.com", "a***@x.com"],
    ["  ana@ejemplo.invalid ", "an***@ejemplo.invalid"],
    ["sin-arroba", "***"],
    ["", "***"],
    [null, "***"],
  ])("%s -> %s", (entrada, esperado) => {
    expect(enmascararCorreo(entrada)).toBe(esperado);
  });
});

describe("entrega", () => {
  it("un correo con forma válida habilita el envío", () => {
    expect(correoUtilizable("ana@ejemplo.invalid")).toBe(true);
    expect(correoUtilizable("ana@")).toBe(false);
    expect(correoUtilizable("")).toBe(false);
    expect(correoUtilizable(undefined)).toBe(false);
  });

  it("sin correo válido la entrega vuelve a «en persona»", () => {
    expect(entregaEfectiva("correo", "")).toBe("persona");
    expect(entregaEfectiva("correo", "ana@ejemplo.invalid")).toBe("correo");
    expect(entregaEfectiva("persona", "ana@ejemplo.invalid")).toBe("persona");
  });
});
