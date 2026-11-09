import { describe, expect, it } from "vitest";

import {
  crearPasoDwellingSchema,
  pasoBasicInfoSchema,
  pasoDwellingSchema,
} from "./schema-registro-pasos";
import { empleadoBasicoFormSchema } from "./schema-empleado";
import { cedulaZod, nombreZod } from "./reglas-personas";

const basico = {
  nacionalidad_id: 1,
  cedulaidentidad: "12345678",
  nombres: "Juan Bernardo",
  apellidos: "Perez Gutierrez",
  fecha_nacimiento: new Date("1990-01-15"),
  sexoid: 1,
  estadoCivil: 1,
};

describe("Reglas de longitud del paso 1 del registro", () => {
  const pasa = (c: Record<string, unknown>) => pasoBasicInfoSchema.safeParse({ ...basico, ...c }).success;

  it("cédula: solo dígitos, 5 a 9", () => {
    expect(pasa({})).toBe(true);
    expect(pasa({ cedulaidentidad: "12345" })).toBe(true);
    expect(pasa({ cedulaidentidad: "1234" })).toBe(false);
    expect(pasa({ cedulaidentidad: "123456" })).toBe(true);
    expect(pasa({ cedulaidentidad: "123456789" })).toBe(true);
    expect(pasa({ cedulaidentidad: "1234567890" })).toBe(false);
    expect(pasa({ cedulaidentidad: "30900439999999999999" })).toBe(false);
    expect(pasa({ cedulaidentidad: "1234a678" })).toBe(false);
  });

  it("nombres y apellidos: letras y espacios, 2 a 60", () => {
    expect(pasa({ nombres: "A" })).toBe(false);
    expect(pasa({ nombres: "Al" })).toBe(true);
    expect(pasa({ nombres: "Maria José" })).toBe(true);
    expect(pasa({ nombres: "Juan 2" })).toBe(false);
    expect(pasa({ apellidos: "B".repeat(60) })).toBe(true);
    expect(pasa({ apellidos: "B".repeat(61) })).toBe(false);
  });

  it("correo: formato y máximo 254 caracteres", () => {
    expect(pasa({ correo: "usuario@conatel.gob.ve" })).toBe(true);
    expect(pasa({ correo: "sin-arroba" })).toBe(false);
    expect(pasa({ correo: `${"a".repeat(250)}@x.co` })).toBe(false);
  });

  it("correo alternativo: formato y distinto del institucional (FIX-QA8)", () => {
    expect(pasa({ correoAlternativo: "personal@gmail.com" })).toBe(true);
    expect(pasa({ correoAlternativo: "" })).toBe(true);
    expect(pasa({ correoAlternativo: "sin-arroba" })).toBe(false);
    expect(
      pasa({ correo: "usuario@conatel.gob.ve", correoAlternativo: "USUARIO@conatel.gob.ve" }),
    ).toBe(false);
    expect(
      pasa({ correo: "usuario@conatel.gob.ve", correoAlternativo: "personal@gmail.com" }),
    ).toBe(true);
  });

  it("carnet de la patria: código de 10 dígitos y serial alfanumérico", () => {
    expect(pasa({ carnet_patria: "1234567890" })).toBe(true);
    expect(pasa({ carnet_patria: "12345" })).toBe(false);
    expect(pasa({ carnet_patria_serial: "AB12" })).toBe(true);
    expect(pasa({ carnet_patria_serial: "AB 12" })).toBe(false);
  });

  it("contacto de emergencia: nombres de 2 a 60", () => {
    const contacto = { nombres: "Maria", apellidos: "Lopez", telefono: "04121234567", relacion_id: 1 };
    expect(pasa({ contacto_emergencia: [contacto] })).toBe(true);
    expect(pasa({ contacto_emergencia: [{ ...contacto, nombres: "M".repeat(61) }] })).toBe(false);
  });
});

describe("Reglas compartidas", () => {
  it("cedulaZod y nombreZod", () => {
    expect(cedulaZod().safeParse("12345").success).toBe(true);
    expect(cedulaZod().safeParse("1234567").success).toBe(true);
    expect(cedulaZod().safeParse("1234").success).toBe(false);
    expect(nombreZod("El nombre").safeParse("Ana").success).toBe(true);
    expect(nombreZod("El nombre").safeParse("A1").success).toBe(false);
  });

  it("dirección: de 10 a 500 caracteres", () => {
    const vivienda = {
      direccion_exacta: "Calle 1, casa 2, sector 3",
      estado_id: 1,
      municipio_id: 1,
      parroquia: 1,
      condicion_vivienda_id: 1,
      codigo_postal_id: 1,
    };
    expect(pasoDwellingSchema.safeParse({ datos_vivienda: vivienda }).success).toBe(true);
    expect(
      pasoDwellingSchema.safeParse({ datos_vivienda: { ...vivienda, direccion_exacta: "x".repeat(501) } }).success,
    ).toBe(false);
    expect(
      pasoDwellingSchema.safeParse({ datos_vivienda: { ...vivienda, direccion_exacta: "x".repeat(9) } }).success,
    ).toBe(false);
  });

  it("O40: Venezuela exige ubicación y otro país exige ciudad o región", () => {
    const base = {
      pais_id: 2,
      direccion_exacta: "Av. Providencia 1234, departamento 5",
      condicion_vivienda_id: 1,
      ciudad_region: "Santiago",
    };
    const exterior = crearPasoDwellingSchema(false);
    expect(exterior.safeParse({ datos_vivienda: base }).success).toBe(true);
    expect(
      exterior.safeParse({ datos_vivienda: { ...base, ciudad_region: "" } }).success,
    ).toBe(false);
    expect(
      pasoDwellingSchema.safeParse({ datos_vivienda: { ...base, pais_id: 1 } }).success,
    ).toBe(false);
  });
});

describe("Formulario «Actualizar Información Básica»", () => {
  const base = {
    nombres: "JUAN",
    apellidos: "PEREZ",
    fechaNacimiento: "1990-01-01",
    sexoId: 1,
    nacionalidadId: 1,
    estadoCivilId: 1,
    correo: "juan@conatel.gob.ve",
    correoAlternativo: "",
    telefonoMovil: "",
    telefonoHabitacion: "",
    carnetPatria: "",
    carnetPatriaSerial: "",
  };

  it("valida el correo alternativo (formato y vacío permitido)", () => {
    const schema = empleadoBasicoFormSchema();
    expect(schema.safeParse(base).success).toBe(true);
    expect(schema.safeParse({ ...base, correoAlternativo: "otro@gmail.com" }).success).toBe(true);
    const mal = schema.safeParse({ ...base, correoAlternativo: "otro" });
    expect(mal.success).toBe(false);
    expect(schema.safeParse({ ...base, correo: "x" }).success).toBe(false);
  });

  it("rechaza que los dos correos sean iguales (FIX-QA8)", () => {
    const schema = empleadoBasicoFormSchema();
    expect(
      schema.safeParse({
        ...base,
        correo: "juan@conatel.gob.ve",
        correoAlternativo: "JUAN@conatel.gob.ve",
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        ...base,
        correo: "juan@conatel.gob.ve",
        correoAlternativo: "juan@gmail.com",
      }).success,
    ).toBe(true);
  });

  it("el código del carnet solo se exige de 10 dígitos si cambió", () => {
    expect(empleadoBasicoFormSchema("000-0000000-00").safeParse({ ...base, carnetPatria: "000-0000000-00" }).success).toBe(true);
    expect(empleadoBasicoFormSchema("000-0000000-00").safeParse({ ...base, carnetPatria: "123" }).success).toBe(false);
    expect(empleadoBasicoFormSchema().safeParse({ ...base, carnetPatria: "1234567890" }).success).toBe(true);
  });
});
