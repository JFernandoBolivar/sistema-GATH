import { describe, expect, it } from "vitest";
import {
  camposFaltantesParaEnviar,
  construirCuerpoBorrador,
  valoresDesdeExpediente,
  VALORES_VACIOS,
  type ValoresVentana1,
} from "./ventana1";
import { esquemaVentana1 } from "../ui/schema/schema-ventana1";

const completo: ValoresVentana1 = {
  ...VALORES_VACIOS,
  nombres: "Ana María",
  apellidos: "Pérez Gómez",
  fechaNacimiento: "1995-04-12",
  sexo: "F",
};

describe("campos obligatorios para enviar", () => {
  it("con el formulario vacío faltan nombres, apellidos, fecha de nacimiento y sexo", () => {
    expect(camposFaltantesParaEnviar(VALORES_VACIOS)).toEqual(["nombres", "apellidos", "fecha_nacimiento", "sexo"]);
  });

  it("fecha de nacimiento y sexo son obligatorios aunque los nombres estén", () => {
    expect(camposFaltantesParaEnviar({ ...completo, fechaNacimiento: "", sexo: "" })).toEqual([
      "fecha_nacimiento",
      "sexo",
    ]);
  });

  it("completo no falta nada; nacionalidad, estado civil y contacto son opcionales", () => {
    expect(camposFaltantesParaEnviar(completo)).toEqual([]);
  });

  it("los espacios no cuentan como contenido", () => {
    expect(camposFaltantesParaEnviar({ ...completo, nombres: "   " })).toEqual(["nombres"]);
  });
});

describe("cuerpo del borrador", () => {
  it("omite las claves vacías y el contacto sin datos", () => {
    const c = construirCuerpoBorrador(completo);
    expect(c.datos_ventana1).toEqual({ fecha_nacimiento: "1995-04-12", sexo: "F" });
    expect(c).toMatchObject({ nombres: "Ana María", apellidos: "Pérez Gómez", correo: "", telefono_movil: "" });
  });

  it("incluye solo las partes del contacto que se escribieron y normaliza espacios", () => {
    const c = construirCuerpoBorrador({
      ...completo,
      nombres: "  Ana   María ",
      contactoEmergencia: { nombre: "Luis  Pérez", telefono: "", parentesco: "Padre" },
      direccionHabitacion: "Av.  Principal  1",
    });
    expect(c.nombres).toBe("Ana María");
    expect(c.datos_ventana1.contacto_emergencia).toEqual({ nombre: "Luis Pérez", parentesco: "Padre" });
    expect(c.datos_ventana1.direccion_habitacion).toBe("Av. Principal 1");
  });

  it("solo usa claves que acepta el backend", () => {
    const permitidas = new Set([
      "fecha_nacimiento", "sexo", "nacionalidad", "estado_civil", "direccion_habitacion",
      "telefono_alterno", "contacto_emergencia",
    ]);
    const c = construirCuerpoBorrador({
      ...completo,
      nacionalidad: "V",
      estadoCivil: "Soltero(a)",
      direccionHabitacion: "x",
      telefonoAlterno: "+584121234567",
      contactoEmergencia: { nombre: "A", telefono: "+584121234567", parentesco: "B" },
    });
    for (const k of Object.keys(c.datos_ventana1)) expect(permitidas.has(k)).toBe(true);
  });
});

describe("valores iniciales", () => {
  it("toma los datos básicos del postulante y los de la ventana guardados", () => {
    const v = valoresDesdeExpediente(
      { nombres: "Ana", apellidos: "Pérez", correo: "a@b.co", telefonoMovil: "+584121234567" },
      { fecha_nacimiento: "1990-01-02", sexo: "M", contacto_emergencia: { nombre: "Luis" }, sexo_raro: 1 },
    );
    expect(v).toMatchObject({ nombres: "Ana", fechaNacimiento: "1990-01-02", sexo: "M" });
    expect(v.contactoEmergencia).toEqual({ nombre: "Luis", telefono: "", parentesco: "" });
  });

  it("un sexo desconocido queda sin elegir", () => {
    expect(valoresDesdeExpediente({ nombres: "", apellidos: "", correo: "", telefonoMovil: "" }, { sexo: "X" }).sexo).toBe("");
  });
});

describe("esquema del formulario", () => {
  it("para guardar basta con nombres y apellidos", () => {
    expect(esquemaVentana1.safeParse(VALORES_VACIOS).success).toBe(false);
    expect(esquemaVentana1.safeParse({ ...VALORES_VACIOS, nombres: "Ana", apellidos: "Pérez" }).success).toBe(true);
  });

  it("rechaza nombres con dígitos y fechas futuras o imposibles", () => {
    const base = { ...VALORES_VACIOS, nombres: "Ana", apellidos: "Pérez" };
    expect(esquemaVentana1.safeParse({ ...base, nombres: "Ana 2" }).success).toBe(false);
    expect(esquemaVentana1.safeParse({ ...base, fechaNacimiento: "2999-01-01" }).success).toBe(false);
    expect(esquemaVentana1.safeParse({ ...base, fechaNacimiento: "2020-02-31" }).success).toBe(false);
    expect(esquemaVentana1.safeParse({ ...base, fechaNacimiento: "1990-02-03" }).success).toBe(true);
  });

  it("valida el celular con la regla por país", () => {
    const base = { ...VALORES_VACIOS, nombres: "Ana", apellidos: "Pérez" };
    expect(esquemaVentana1.safeParse({ ...base, telefonoMovil: "+584121234567" }).success).toBe(true);
    expect(esquemaVentana1.safeParse({ ...base, telefonoMovil: "123" }).success).toBe(false);
  });
});
