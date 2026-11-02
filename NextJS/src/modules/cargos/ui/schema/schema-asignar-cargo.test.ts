import { describe, expect, it } from "vitest";
import { asignarCargoSchema } from "./schema-asignar-cargo";

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
