import { describe, expect, it } from "vitest";
import {
  buscarEmpleadoCarnetSchema,
  disenarCarnetSchema,
  emitirCarnetSchema,
} from "./schema-carnet";

describe("Schema de Emisión de Carnets", () => {
  it("valida emisión con datos correctos", () => {
    const res = emitirCarnetSchema.safeParse({
      empleadoCedula: "12345678",
      motivoId: 1,
    });
    expect(res.success).toBe(true);
  });

  it("falla si no se selecciona un motivo", () => {
    const res = emitirCarnetSchema.safeParse({
      empleadoCedula: "12345678",
      motivoId: 0,
    });
    expect(res.success).toBe(false);
  });

  it("valida cédula para búsqueda de trabajador", () => {
    expect(buscarEmpleadoCarnetSchema.safeParse({ cedula: "12345678" }).success).toBe(true);
    expect(buscarEmpleadoCarnetSchema.safeParse({ cedula: "abc" }).success).toBe(false);
    expect(buscarEmpleadoCarnetSchema.safeParse({ cedula: "" }).success).toBe(false);
  });

  it("valida datos completos para el diseñador de carnet", () => {
    const valid = disenarCarnetSchema.safeParse({
      empleadoCedula: "12345678",
      nombreTitular: "Pedro Pérez",
      motivoId: 1,
    });
    expect(valid.success).toBe(true);

    const invalid = disenarCarnetSchema.safeParse({
      empleadoCedula: "12345678",
      nombreTitular: "ab", // menos de 3 caracteres
      motivoId: 1,
    });
    expect(invalid.success).toBe(false);
  });
});
