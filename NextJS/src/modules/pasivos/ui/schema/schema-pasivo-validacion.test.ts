import { describe, expect, it } from "vitest";
import { familiarSchema } from "@/modules/familiares/ui/schema/schema-familiar";
import { NAME, NAME_EDICION } from "@/shared/domain/validation";
import { actualizarPasivoSchema, filtrosPasivosSchema, registrarPasivoSchema } from "./schema-pasivo";

const base = {
  cedula: "12345678",
  nombres: "JUAN",
  apellidos: "PÉREZ",
  sexoId: 1,
  fechaNacimiento: "1950-01-01",
  tipoNominaId: 1,
};

describe("validación de nombres y números (crítica 2026-11-03)", () => {
  it("NAME acepta letras, acentos, ñ y apóstrofo; rechaza números y símbolos", () => {
    for (const ok of ["María José", "PEÑA", "D'EMILIO", "GONZÀLEZ"]) expect(NAME.test(ok)).toBe(true);
    for (const mal of ["Ana2", "123", "Ana_Luisa", "<b>", "JOSE A."]) expect(NAME.test(mal)).toBe(false);
  });

  it("NAME_EDICION tolera la inicial con punto del legado pero no números", () => {
    expect(NAME_EDICION.test("JOSE A.")).toBe(true);
    expect(NAME_EDICION.test("JOSE 2")).toBe(false);
  });

  it("alta de pasivo: rechaza nombres con números, cédula con letras y teléfono con letras", () => {
    expect(registrarPasivoSchema.safeParse(base).success).toBe(true);
    const r = registrarPasivoSchema.safeParse({ ...base, cedula: "12A45", nombres: "JUAN 2", telefonoMovil: "0414ABC4567" });
    expect(r.success).toBe(false);
    const campos = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(campos).toEqual(expect.arrayContaining(["cedula", "nombres", "telefonoMovil"]));
  });

  it("edición de pasivo: teléfono con guion es válido; apellido con número no", () => {
    expect(actualizarPasivoSchema.safeParse({ telefonoMovil: "0414-1234567", nombres: "JOSE A." }).success).toBe(true);
    expect(actualizarPasivoSchema.safeParse({ apellidos: "PEREZ 3" }).success).toBe(false);
  });

  it("FIX-QA8: los dos correos se validan y no pueden ser iguales", () => {
    const alta = registrarPasivoSchema.safeParse({
      ...base,
      correo: "institucional@conatel.gob.ve",
      correoAlternativo: "personal@gmail.com",
    });
    expect(alta.success).toBe(true);
    expect(
      registrarPasivoSchema.safeParse({
        ...base,
        correo: "institucional@conatel.gob.ve",
        correoAlternativo: "INSTITUCIONAL@conatel.gob.ve",
      }).success,
    ).toBe(false);

    expect(
      actualizarPasivoSchema.safeParse({
        correo: "institucional@conatel.gob.ve",
        correoAlternativo: "personal@gmail.com",
      }).success,
    ).toBe(true);
    expect(
      actualizarPasivoSchema.safeParse({
        correo: "institucional@conatel.gob.ve",
        correoAlternativo: "institucional@conatel.gob.ve",
      }).success,
    ).toBe(false);
  });

  it("familiar: parentesco obligatorio y cédula solo con dígitos", () => {
    const familiar = {
      empleadoCedula: "12345678",
      primerNombre: "ANA",
      primerApellido: "PÉREZ",
      cedulaFamiliar: "12A45678",
      fechaNacimiento: "2010-01-01",
      sexoId: 1,
    };
    const r = familiarSchema.safeParse(familiar);
    expect(r.success).toBe(false);
    const campos = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(campos).toEqual(expect.arrayContaining(["parentescoId", "cedulaFamiliar"]));
  });

  it("FIX-QA11: filtrosPasivosSchema acepta sinCuenta booleano o indefinido", () => {
    expect(filtrosPasivosSchema.safeParse({ sinCuenta: true }).success).toBe(true);
    expect(filtrosPasivosSchema.safeParse({ sinCuenta: false }).success).toBe(true);
    expect(filtrosPasivosSchema.safeParse({}).success).toBe(true);
  });
});
