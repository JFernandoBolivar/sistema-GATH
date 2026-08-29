import { describe, expect, it } from "vitest";
import { historialCargoSchema, historialEmpleadoSchema } from "./schema-historial";

describe("Schema de Historial de Movimientos", () => {
  describe("historialEmpleadoSchema", () => {
    it("valida una cédula válida", () => {
      const valid = historialEmpleadoSchema.safeParse({
        empleadoCedula: "12345678",
      });
      expect(valid.success).toBe(true);
    });

    it("falla si la cédula no contiene solo dígitos", () => {
      const invalid = historialEmpleadoSchema.safeParse({
        empleadoCedula: "1234-5678",
      });
      expect(invalid.success).toBe(false);
    });

    it("falla si la cédula contiene letras no permitidas", () => {
      const invalid = historialEmpleadoSchema.safeParse({
        empleadoCedula: "A1234567",
      });
      expect(invalid.success).toBe(false);
    });

    it("falla si la cédula está vacía", () => {
      const invalid = historialEmpleadoSchema.safeParse({
        empleadoCedula: "",
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("historialCargoSchema", () => {
    it("valida un código de puesto válido", () => {
      const valid = historialCargoSchema.safeParse({
        codigoPuesto: "0-00-000000-00",
      });
      expect(valid.success).toBe(true);
    });

    it("valida un código de puesto alfanumérico con guiones", () => {
      const valid = historialCargoSchema.safeParse({
        codigoPuesto: "COD-001",
      });
      expect(valid.success).toBe(true);
    });

    it("falla si el código de puesto es demasiado corto", () => {
      const invalid = historialCargoSchema.safeParse({
        codigoPuesto: "0",
      });
      expect(invalid.success).toBe(false);
    });

    it("falla si el código de puesto está vacío", () => {
      const invalid = historialCargoSchema.safeParse({
        codigoPuesto: "",
      });
      expect(invalid.success).toBe(false);
    });
  });
});
