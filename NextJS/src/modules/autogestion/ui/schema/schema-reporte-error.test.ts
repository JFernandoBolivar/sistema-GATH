import { describe, expect, it } from "vitest";
import {
  DESCRIPCION_MAX,
  DESCRIPCION_MIN,
  reporteErrorLaboralSchema,
} from "./schema-reporte-error";

describe("reporteErrorLaboralSchema", () => {
  const base = { dato: "cargo" as const };
  it("rechaza descripciones por debajo del mínimo (tras recortar espacios)", () => {
    const corta = "a".repeat(DESCRIPCION_MIN - 1);
    expect(reporteErrorLaboralSchema.safeParse({ ...base, descripcion: corta }).success).toBe(
      false,
    );
    expect(
      reporteErrorLaboralSchema.safeParse({ ...base, descripcion: `  ${corta}  ` }).success,
    ).toBe(false);
  });
  it("acepta el mínimo y el máximo exactos y rechaza el exceso", () => {
    const ok = (n: number) =>
      reporteErrorLaboralSchema.safeParse({ ...base, descripcion: "a".repeat(n) }).success;
    expect(ok(DESCRIPCION_MIN)).toBe(true);
    expect(ok(DESCRIPCION_MAX)).toBe(true);
    expect(ok(DESCRIPCION_MAX + 1)).toBe(false);
  });
  it("rechaza un dato fuera del catálogo", () => {
    expect(
      reporteErrorLaboralSchema.safeParse({ dato: "x", descripcion: "a".repeat(20) }).success,
    ).toBe(false);
  });
});
