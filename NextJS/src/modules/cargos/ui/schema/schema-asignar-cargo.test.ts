import { describe, expect, it } from "vitest";
import { asignarCargoSchema, crearCargoSchema, schemaPrestamoCargo } from "./schema-asignar-cargo";

describe("Schema de Asignación de Cargo", () => {
  it("valida payload correcto", () => {
    const valid = asignarCargoSchema.safeParse({
      cargoId: 10,
      empleadoCedula: "12345678",
    });
    expect(valid.success).toBe(true);
  });

  it("falla si la cédula contiene letras", () => {
    const invalid = asignarCargoSchema.safeParse({
      cargoId: 10,
      empleadoCedula: "V12345678",
    });
    expect(invalid.success).toBe(false);
  });

  it("falla si cargoId es inválido", () => {
    const invalid = asignarCargoSchema.safeParse({
      cargoId: -1,
      empleadoCedula: "12345678",
    });
    expect(invalid.success).toBe(false);
  });
});

describe("Schema de creación de código (crearCargoSchema)", () => {
  const base = { denominacionId: 1, especificaId: 2, tipoNominaId: 3 };

  it("acepta Nivel + Dirección General", () => {
    expect(crearCargoSchema.safeParse({ ...base, dependenciaId: 4, direccionGeneralId: 5 }).success).toBe(true);
  });

  it("rechaza un código solo con el Nivel y marca el campo de la Dirección General", () => {
    const r = crearCargoSchema.safeParse({ ...base, dependenciaId: 4 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain("direccionGeneralId");
  });

  it("rechaza un código sin Nivel", () => {
    const r = crearCargoSchema.safeParse({ ...base, direccionGeneralId: 5 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain("dependenciaId");
  });

  it("limita las observaciones a 500 caracteres y exige mínimo 3 si se escriben", () => {
    const ok = { ...base, dependenciaId: 4, direccionGeneralId: 5 };
    expect(crearCargoSchema.safeParse({ ...ok, observaciones: "x".repeat(501) }).success).toBe(false);
    expect(crearCargoSchema.safeParse({ ...ok, observaciones: "ab" }).success).toBe(false);
    expect(crearCargoSchema.safeParse({ ...ok, observaciones: "" }).success).toBe(true);
  });
});

describe("Schema de encargaduría: motivo", () => {
  const base = { cargo_encargado: 1, empleado_encargado: "123", motivo: 7, fecha_inicio: new Date("2026-01-01"), fecha_fin: new Date("2026-02-01") };
  it("exige elegir un motivo existente (el nuevo se crea desde «Otros…» antes de enviar)", () => {
    expect(schemaPrestamoCargo.safeParse(base).success).toBe(true);
    expect(schemaPrestamoCargo.safeParse({ ...base, motivo: 0 }).success).toBe(false);
    expect(schemaPrestamoCargo.safeParse({ ...base, motivo: -1 }).success).toBe(false);
  });
});
