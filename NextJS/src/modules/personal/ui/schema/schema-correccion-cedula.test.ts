import { describe, expect, it } from "vitest";

import {
  confirmacionCedulaCoincide,
  ejecutarCedulaSchema,
  solicitudCedulaSchema,
} from "./schema-correccion-cedula";

describe("schema de corrección de cédula", () => {
  it("acepta solo dígitos de 6 a 9", () => {
    const ok = solicitudCedulaSchema.safeParse({ cedulaActual: "12345678", cedulaNueva: "12345687" });
    expect(ok.success).toBe(true);
    for (const mala of ["12345", "1234567890", "12a45678", ""]) {
      expect(
        solicitudCedulaSchema.safeParse({ cedulaActual: mala, cedulaNueva: "12345687" }).success,
      ).toBe(false);
    }
  });

  it("rechaza cédulas iguales", () => {
    expect(
      solicitudCedulaSchema.safeParse({ cedulaActual: "12345678", cedulaNueva: "12345678" }).success,
    ).toBe(false);
  });

  it("exige motivo de 10 a 500 caracteres y confirmación igual", () => {
    const base = {
      cedulaActual: "12345678",
      cedulaNueva: "12345687",
      motivo: "Error de transcripción",
      confirmacion: "12345687",
    };
    expect(ejecutarCedulaSchema.safeParse(base).success).toBe(true);
    expect(ejecutarCedulaSchema.safeParse({ ...base, motivo: "corto" }).success).toBe(false);
    expect(ejecutarCedulaSchema.safeParse({ ...base, motivo: "x".repeat(501) }).success).toBe(false);
    expect(ejecutarCedulaSchema.safeParse({ ...base, confirmacion: "12345678" }).success).toBe(false);
  });

  it("confirmacionCedulaCoincide compara exacto", () => {
    expect(confirmacionCedulaCoincide(" 12345687 ", "12345687")).toBe(true);
    expect(confirmacionCedulaCoincide("1234568", "12345687")).toBe(false);
  });
});
