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

  it("acepta cedulaFamiliar vacía (familiar menor de edad sin cédula propia)", () => {
    const res = familiarSchema.safeParse({
      empleadoCedula: "12345678",
      cedulaFamiliar: "",
      primerNombre: "María",
      primerApellido: "Pérez",
      parentescoId: 1,
      fechaNacimiento: "2015-05-10",
      sexoId: 2,
      mismoEnte: false,
      heredero: true,
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.cedulaFamiliar).toBeNull();
  });

  it("TLF-1: rechaza fechas futuras y órdenes fuera de rango", () => {
    const base = {
      empleadoCedula: "12345678",
      primerNombre: "María",
      primerApellido: "Pérez",
      parentescoId: 1,
      fechaNacimiento: "2022-05-10",
      sexoId: 2,
      mismoEnte: false,
      heredero: true,
      ordenHijo: 2,
    };
    expect(familiarSchema.safeParse(base).success).toBe(true);
    expect(familiarSchema.safeParse({ ...base, fechaNacimiento: "2099-01-01" }).success).toBe(false);
    expect(familiarSchema.safeParse({ ...base, ordenHijo: 0 }).success).toBe(false);
    expect(familiarSchema.safeParse({ ...base, ordenHijo: 100 }).success).toBe(false);
  });

  it("falla si cedulaFamiliar tiene contenido pero no es válida", () => {
    const res = familiarSchema.safeParse({
      empleadoCedula: "12345678",
      cedulaFamiliar: "abc",
      primerNombre: "María",
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

describe("Longitudes del familiar (QA 2026-11-04)", () => {
  const base = {
    empleadoCedula: "12345678",
    primerNombre: "Maria",
    primerApellido: "Perez",
    parentescoId: 1,
    fechaNacimiento: "2015-05-10",
    sexoId: 2,
    mismoEnte: false,
    heredero: false,
  };
  const pasa = (c: Record<string, unknown>) => familiarSchema.safeParse({ ...base, ...c }).success;

  it("cédula del familiar: solo dígitos, 5 a 9", () => {
    expect(pasa({ cedulaFamiliar: "12345" })).toBe(true);
    expect(pasa({ cedulaFamiliar: "1234" })).toBe(false);
    expect(pasa({ cedulaFamiliar: "123456" })).toBe(true);
    expect(pasa({ cedulaFamiliar: "123456789" })).toBe(true);
    expect(pasa({ cedulaFamiliar: "1234567890" })).toBe(false);
    expect(pasa({ cedulaFamiliar: "30900439999999999999" })).toBe(false);
    expect(pasa({ cedulaFamiliar: "12ab5678" })).toBe(false);
  });

  it("nombres de 2 a 60 caracteres; segundos opcionales (también vacíos)", () => {
    expect(pasa({ primerNombre: "M" })).toBe(false);
    expect(pasa({ primerNombre: "M".repeat(61) })).toBe(false);
    expect(pasa({ segundoNombre: "" })).toBe(true);
    expect(pasa({ segundoApellido: "A".repeat(61) })).toBe(false);
  });

  it("observaciones: máximo 500 caracteres", () => {
    expect(pasa({ observaciones: "x".repeat(500) })).toBe(true);
    expect(pasa({ observaciones: "x".repeat(501) })).toBe(false);
  });
});
