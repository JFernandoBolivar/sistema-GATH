import { describe, expect, it } from "vitest";
import { familiarSchema } from "./schema-familiar";

describe("Schema de Cargas Familiares", () => {
  it("valida familiar con datos completos", () => {
    const res = familiarSchema.safeParse({
      empleadoCedula: "12345678",
      primerNombre: "María",
      primerApellido: "Pérez",
      parentescoId: 1,
      fechaNacimiento: "2015-05-10",
      sexoId: 2,
      mismoEnte: false,
      heredero: true,
    });
    expect(res.success).toBe(true);
  });

  it("falla si los nombres contienen números o símbolos", () => {
    const res = familiarSchema.safeParse({
      empleadoCedula: "12345678",
      primerNombre: "María123",
      primerApellido: "Pérez",
      parentescoId: 1,
      fechaNacimiento: "2015-05-10",
      sexoId: 2,
      mismoEnte: false,
      heredero: true,
    });
    expect(res.success).toBe(false);
  });

  it("falla si la fecha no tiene formato ISO", () => {
    const res = familiarSchema.safeParse({
      empleadoCedula: "12345678",
      primerNombre: "María",
      primerApellido: "Pérez",
      parentescoId: 1,
      fechaNacimiento: "10/05/2015",
      sexoId: 2,
      mismoEnte: false,
      heredero: true,
    });
    expect(res.success).toBe(false);
  });
});
