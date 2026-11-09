import { describe, expect, it } from "vitest";

import { actualizarPasivoSchema, registrarPasivoSchema } from "./schema-pasivo";

const base = {
  cedula: "12345678",
  nombres: "JUAN",
  apellidos: "PÉREZ",
  sexoId: 1,
  fechaNacimiento: "1950-01-01",
  tipoNominaId: 1,
  motivoId: 1,
  fechaVigencia: "2020-01-01",
};

describe("teléfonos del pasivo (D-13)", () => {
  it("son opcionales", () => {
    expect(registrarPasivoSchema.safeParse(base).success).toBe(true);
    expect(
      registrarPasivoSchema.safeParse({ ...base, telefonoMovil: "", telefonoHabitacion: null })
        .success,
    ).toBe(true);
    expect(
      actualizarPasivoSchema.safeParse({ telefonoMovil: "", telefonoHabitacion: "" }).success,
    ).toBe(true);
  });
  it("aceptan venezolanos con y sin 0 y con código de país", () => {
    for (const telefonoMovil of ["04121234567", "4121234567", "+584121234567", "0412-123 4567"]) {
      expect(
        registrarPasivoSchema.safeParse({ ...base, telefonoMovil }).success,
        telefonoMovil,
      ).toBe(true);
      expect(actualizarPasivoSchema.safeParse({ telefonoMovil }).success, telefonoMovil).toBe(true);
    }
  });
  it("el móvil exige móvil y la habitación acepta fijo", () => {
    expect(registrarPasivoSchema.safeParse({ ...base, telefonoMovil: "02121234567" }).success).toBe(
      false,
    );
    expect(
      registrarPasivoSchema.safeParse({ ...base, telefonoHabitacion: "02121234567" }).success,
    ).toBe(true);
    expect(actualizarPasivoSchema.safeParse({ telefonoMovil: "02121234567" }).success).toBe(false);
  });
  it("rechaza letras y longitudes inválidas", () => {
    expect(registrarPasivoSchema.safeParse({ ...base, telefonoMovil: "abc" }).success).toBe(false);
    expect(registrarPasivoSchema.safeParse({ ...base, telefonoHabitacion: "123" }).success).toBe(
      false,
    );
    expect(actualizarPasivoSchema.safeParse({ telefonoMovil: "041212345678" }).success).toBe(false);
  });
});
