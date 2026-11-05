import { describe, expect, it } from "vitest";

import { datosContactoSchema } from "./schema-fe-de-vida";

const base = { correoAlternativo: "", tieneHijos: "no" as const };

describe("teléfonos de fe de vida (D-13)", () => {
  it("el celular es obligatorio y la habitación opcional", () => {
    const sinCelular = datosContactoSchema.safeParse({
      ...base,
      telefonoMovil: "",
      telefonoHabitacion: "",
    });
    expect(sinCelular.success).toBe(false);
    expect(sinCelular.error?.issues[0]?.message).toBe("El teléfono celular es obligatorio");
    expect(
      datosContactoSchema.safeParse({
        ...base,
        telefonoMovil: "04121234567",
        telefonoHabitacion: "",
      }).success,
    ).toBe(true);
  });
  it("aceptan venezolanos con y sin 0 y con código de país", () => {
    for (const telefonoMovil of ["04121234567", "4121234567", "+584121234567"]) {
      expect(
        datosContactoSchema.safeParse({ ...base, telefonoMovil, telefonoHabitacion: "" }).success,
        telefonoMovil,
      ).toBe(true);
    }
  });
  it("el celular exige móvil; la habitación acepta fijo", () => {
    expect(
      datosContactoSchema.safeParse({
        ...base,
        telefonoMovil: "02121234567",
        telefonoHabitacion: "",
      }).success,
    ).toBe(false);
    expect(
      datosContactoSchema.safeParse({
        ...base,
        telefonoMovil: "04121234567",
        telefonoHabitacion: "02121234567",
      }).success,
    ).toBe(true);
  });
  it("rechaza letras y números inválidos", () => {
    expect(
      datosContactoSchema.safeParse({ ...base, telefonoMovil: "abc", telefonoHabitacion: "" })
        .success,
    ).toBe(false);
    expect(
      datosContactoSchema.safeParse({
        ...base,
        telefonoMovil: "04121234567",
        telefonoHabitacion: "123",
      }).success,
    ).toBe(false);
  });
});
