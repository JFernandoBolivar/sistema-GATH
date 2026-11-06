import { describe, expect, it } from "vitest";

import { contactoEmergenciaFormSchema } from "./schema-contacto-emergencia";
import { empleadoSchema } from "./schema-empleado";
import { pasoBasicInfoBaseSchema } from "./schema-registro-pasos";

const contacto = {
  nombres: "Ana Maria",
  apellidos: "Ruiz",
  telefono: "+584121234567",
  relacion_id: 7,
};

describe("teléfono del contacto de emergencia (D-13)", () => {
  it("es obligatorio", () => {
    expect(contactoEmergenciaFormSchema.safeParse({ ...contacto, telefono: "" }).success).toBe(
      false,
    );
    expect(
      contactoEmergenciaFormSchema.safeParse({ ...contacto, telefono: undefined }).success,
    ).toBe(false);
  });
  it("acepta móvil, fijo venezolano (con y sin 0) y otros países", () => {
    for (const telefono of [
      "+584121234567",
      "04121234567",
      "4121234567",
      "0212-1234567",
      "+14155552671",
    ]) {
      expect(
        contactoEmergenciaFormSchema.safeParse({ ...contacto, telefono }).success,
        telefono,
      ).toBe(true);
    }
  });
  it("rechaza letras y números inválidos", () => {
    for (const telefono of ["abc", "0412123", "+5841212345678901"]) {
      expect(
        contactoEmergenciaFormSchema.safeParse({ ...contacto, telefono }).success,
        telefono,
      ).toBe(false);
    }
  });
});

describe("teléfonos del paso 1 del wizard (D-13)", () => {
  const campos = (extra: Record<string, unknown>) =>
    pasoBasicInfoBaseSchema.pick({ telefono_movil: true, telefono_habitacion: true }).safeParse(extra);

  it("son opcionales", () => {
    expect(campos({}).success).toBe(true);
    expect(campos({ telefono_movil: "", telefono_habitacion: "" }).success).toBe(true);
  });
  it("el móvil debe ser móvil; la habitación puede ser fija", () => {
    expect(
      campos({ telefono_movil: "04121234567", telefono_habitacion: "02121234567" }).success,
    ).toBe(true);
    expect(campos({ telefono_movil: "+584121234567" }).success).toBe(true);
    expect(campos({ telefono_movil: "02121234567" }).success).toBe(false);
    expect(campos({ telefono_movil: "abc" }).success).toBe(false);
    expect(campos({ telefono_habitacion: "123" }).success).toBe(false);
  });
});

describe("teléfonos del empleado (D-13)", () => {
  const campos = (extra: Record<string, unknown>) =>
    empleadoSchema.pick({ telefonoMovil: true, telefonoHabitacion: true }).safeParse(extra);

  it("aceptan vacío, nulo y E.164", () => {
    expect(campos({}).success).toBe(true);
    expect(campos({ telefonoMovil: null, telefonoHabitacion: "" }).success).toBe(true);
    expect(
      campos({ telefonoMovil: "+584141234567", telefonoHabitacion: "+582121234567" }).success,
    ).toBe(true);
  });
  it("rechazan un fijo como móvil y números inválidos", () => {
    expect(campos({ telefonoMovil: "+582121234567" }).success).toBe(false);
    expect(campos({ telefonoMovil: "12" }).success).toBe(false);
    expect(campos({ telefonoHabitacion: "xx" }).success).toBe(false);
  });
});
