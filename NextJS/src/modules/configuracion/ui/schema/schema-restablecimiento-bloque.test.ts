import { describe, expect, it } from "vitest";
import {
  confirmacionCoincide,
  ejecutarBloqueSchema,
  solicitudBloqueSchema,
} from "./schema-restablecimiento-bloque";

const base = {
  clasificacion: "AMBOS",
  alcance: "SIN_PRIMER_INGRESO",
  enviarCorreo: true,
  motivo: "Plazo inicial vencido",
};

describe("schema restablecimiento en bloque", () => {
  it("acepta una solicitud válida", () => {
    expect(solicitudBloqueSchema.safeParse(base).success).toBe(true);
  });
  it("rechaza un motivo de menos de 10 caracteres", () => {
    expect(solicitudBloqueSchema.safeParse({ ...base, motivo: "corto" }).success).toBe(false);
    expect(solicitudBloqueSchema.safeParse({ ...base, motivo: "   corto   " }).success).toBe(false);
  });
  it("rechaza clasificación o alcance desconocidos", () => {
    expect(solicitudBloqueSchema.safeParse({ ...base, clasificacion: "X" }).success).toBe(false);
    expect(solicitudBloqueSchema.safeParse({ ...base, alcance: "X" }).success).toBe(false);
  });
  it("la ejecución exige una confirmación numérica", () => {
    expect(ejecutarBloqueSchema.safeParse({ ...base, confirmacion: 12 }).success).toBe(true);
    expect(ejecutarBloqueSchema.safeParse({ ...base, confirmacion: -1 }).success).toBe(false);
    expect(ejecutarBloqueSchema.safeParse(base).success).toBe(false);
  });
  it("confirmacionCoincide solo vale con el número exacto", () => {
    expect(confirmacionCoincide("120", 120)).toBe(true);
    expect(confirmacionCoincide(" 120 ", 120)).toBe(true);
    expect(confirmacionCoincide("119", 120)).toBe(false);
    expect(confirmacionCoincide("12a", 12)).toBe(false);
    expect(confirmacionCoincide("", 0)).toBe(false);
  });
});
