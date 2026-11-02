import { describe, expect, it } from "vitest";
import {
  confirmacionEnvioSchema,
  datosContactoSchema,
  devolverSchema,
  filtrosBandejaSchema,
  procesoSchema,
  prorrogaSchema,
} from "./schema-fe-de-vida";

describe("datosContactoSchema", () => {
  const ok = { telefonoMovil: "0412-1234567", telefonoHabitacion: "", correoAlternativo: "", tieneHijos: "no" };
  it("acepta datos válidos y campos opcionales vacíos", () => {
    expect(datosContactoSchema.safeParse(ok).success).toBe(true);
  });
  it("exige responder «¿tiene hijos?»", () => {
    expect(datosContactoSchema.safeParse({ ...ok, tieneHijos: "" }).success).toBe(false);
  });
  it("valida teléfono y correo", () => {
    expect(datosContactoSchema.safeParse({ ...ok, telefonoMovil: "abc" }).success).toBe(false);
    expect(datosContactoSchema.safeParse({ ...ok, correoAlternativo: "no-es-correo" }).success).toBe(false);
  });
});

describe("decisiones", () => {
  it("devolver exige motivo y acepta la casilla de nueva foto", () => {
    expect(devolverSchema.safeParse({ motivo: "  ", requiereNuevaFoto: false }).success).toBe(false);
    const r = devolverSchema.safeParse({ motivo: "Foto borrosa", requiereNuevaFoto: true });
    expect(r.success && r.data.requiereNuevaFoto).toBe(true);
  });
  it("el motivo no puede superar 500 caracteres", () => {
    expect(devolverSchema.safeParse({ motivo: "a".repeat(501), requiereNuevaFoto: false }).success).toBe(false);
  });
  it("la declaración de envío debe estar marcada", () => {
    expect(confirmacionEnvioSchema.safeParse({ declaro: false }).success).toBe(false);
    expect(confirmacionEnvioSchema.safeParse({ declaro: true }).success).toBe(true);
  });
  it("el rango de fechas de la bandeja es coherente", () => {
    const base = { texto: "", estado: "", procesoId: "" };
    expect(filtrosBandejaSchema.safeParse({ ...base, desde: "2026-02-01", hasta: "2026-01-01" }).success).toBe(false);
    expect(filtrosBandejaSchema.safeParse({ ...base, desde: "2026-01-01", hasta: "2026-02-01" }).success).toBe(true);
  });
});

describe("procesoSchema", () => {
  const base = {
    nombre: "Fe de vida 2026-2027",
    apertura: "2026-11-01T08:00",
    cierre: "2026-12-01T08:00",
    todos: true,
    tiposNomina: [] as number[],
    diasRecordatorio: [7, 3, 1],
  };
  it("acepta alcance «Todos» sin tipos", () => {
    expect(procesoSchema.safeParse(base).success).toBe(true);
  });
  it("sin «Todos» exige al menos un tipo de pensión", () => {
    expect(procesoSchema.safeParse({ ...base, todos: false }).success).toBe(false);
    expect(procesoSchema.safeParse({ ...base, todos: false, tiposNomina: [3] }).success).toBe(true);
  });
  it("el cierre debe ser posterior a la apertura y los días válidos", () => {
    expect(procesoSchema.safeParse({ ...base, cierre: base.apertura }).success).toBe(false);
    expect(procesoSchema.safeParse({ ...base, diasRecordatorio: [0] }).success).toBe(false);
    expect(procesoSchema.safeParse({ ...base, diasRecordatorio: [366] }).success).toBe(false);
    expect(procesoSchema.safeParse({ ...base, diasRecordatorio: [2.5] }).success).toBe(false);
    expect(procesoSchema.safeParse({ ...base, diasRecordatorio: [] }).success).toBe(true);
  });
});

describe("prorrogaSchema", () => {
  it("la cédula es opcional (general) y el motivo obligatorio", () => {
    const base = { cedula: "", nuevaFechaLimite: "2026-12-10T08:00", motivo: "Caso especial" };
    expect(prorrogaSchema.safeParse(base).success).toBe(true);
    expect(prorrogaSchema.safeParse({ ...base, cedula: "12345678" }).success).toBe(true);
    expect(prorrogaSchema.safeParse({ ...base, cedula: "V-12" }).success).toBe(false);
    expect(prorrogaSchema.safeParse({ ...base, motivo: "" }).success).toBe(false);
  });
});
