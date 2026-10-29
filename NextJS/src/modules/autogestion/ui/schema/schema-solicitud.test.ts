import { describe, expect, it } from "vitest";
import {
  contactoSchema,
  esquemaDeEntidad,
  familiarSchema,
  formacionSchema,
  habilitarVentanaSchema,
  prorrogaSchema,
  rechazoSchema,
  solicitudNuevaSchema,
  viviendaSchema,
} from "./schema-solicitud";

describe("solicitudNuevaSchema", () => {
  it("exige al menos una sección y un motivo", () => {
    expect(solicitudNuevaSchema.safeParse({ secciones: [], motivo: "x" }).success).toBe(false);
    expect(solicitudNuevaSchema.safeParse({ secciones: ["contacto"], motivo: "  " }).success).toBe(
      false,
    );
    expect(
      solicitudNuevaSchema.safeParse({ secciones: ["contacto"], motivo: "Cambié de número" })
        .success,
    ).toBe(true);
  });
  it("rechaza secciones desconocidas, HTML y motivos largos", () => {
    expect(solicitudNuevaSchema.safeParse({ secciones: ["cargo"], motivo: "x" }).success).toBe(
      false,
    );
    expect(
      solicitudNuevaSchema.safeParse({ secciones: ["foto"], motivo: "<b>x</b>" }).success,
    ).toBe(false);
    expect(
      solicitudNuevaSchema.safeParse({ secciones: ["foto"], motivo: "a".repeat(501) }).success,
    ).toBe(false);
  });
});

describe("contactoSchema", () => {
  it("acepta teléfonos y correo alternativo válidos o vacíos", () => {
    expect(
      contactoSchema.safeParse({ telefono_movil: "0412-1234567", correo_alternativo: "a@b.co" })
        .success,
    ).toBe(true);
    expect(
      contactoSchema.safeParse({
        telefono_movil: "",
        telefono_habitacion: "",
        correo_alternativo: "",
      }).success,
    ).toBe(true);
  });
  it("rechaza teléfono y correo con formato inválido", () => {
    expect(contactoSchema.safeParse({ telefono_movil: "abc" }).success).toBe(false);
    const r = contactoSchema.safeParse({ correo_alternativo: "sin-arroba" });
    expect(r.success).toBe(false);
  });
});

describe("viviendaSchema / formacionSchema", () => {
  it("convierte ids de texto a número y exige los obligatorios", () => {
    const ok = viviendaSchema.parse({
      estado_id: "1",
      municipio_id: "2",
      parroquia_id: "3",
      direccion_exacta: "Calle 1",
      condicion_vivienda_id: "4",
      codigo_postal_id: "5",
    });
    expect(ok.estado_id).toBe(1);
    expect(viviendaSchema.safeParse({ ...ok, estado_id: "" }).success).toBe(false);
    expect(
      formacionSchema.parse({ nivel_academico_id: "2", carrera_id: "" }).carrera_id,
    ).toBeNull();
    expect(formacionSchema.safeParse({ nivel_academico_id: "" }).success).toBe(false);
  });
});

describe("familiarSchema", () => {
  const base = {
    primer_nombre: "Ana",
    primer_apellido: "Pérez",
    parentesco_id: "1",
    fecha_nacimiento: "2015-05-01",
    sexo_id: "2",
  };
  it("acepta un familiar completo", () => {
    expect(familiarSchema.safeParse(base).success).toBe(true);
  });
  it("rechaza fecha futura, cédula inválida y datos faltantes", () => {
    expect(familiarSchema.safeParse({ ...base, fecha_nacimiento: "2999-01-01" }).success).toBe(
      false,
    );
    expect(familiarSchema.safeParse({ ...base, cedula_familiar: "xx" }).success).toBe(false);
    expect(familiarSchema.safeParse({ ...base, primer_nombre: "" }).success).toBe(false);
  });
});

describe("esquemaDeEntidad", () => {
  it("resuelve por sección y entidad; desconocidas devuelven null", () => {
    expect(esquemaDeEntidad("contacto", "employee")).not.toBeNull();
    expect(
      esquemaDeEntidad("familiar", "datos_complementarios")?.safeParse({ tiene_hijos: "true" })
        .success,
    ).toBe(true);
    expect(esquemaDeEntidad("foto", "employee")).toBeNull();
  });
  it("tiene_hijos se convierte a booleano o nulo", () => {
    const e = esquemaDeEntidad("familiar", "datos_complementarios");
    expect(e?.parse({ tiene_hijos: "false" })).toEqual({ tiene_hijos: false });
    expect(e?.parse({ tiene_hijos: "" })).toEqual({ tiene_hijos: null });
  });
});

describe("esquemas de Bienestar", () => {
  it("el plazo va de 1 a 90 días enteros", () => {
    const s = (plazoDias: unknown) =>
      habilitarVentanaSchema.safeParse({ plazoDias, secciones: ["contacto"] }).success;
    expect(s(15)).toBe(true);
    expect(s("30")).toBe(true);
    expect(s(0)).toBe(false);
    expect(s(91)).toBe(false);
    expect(s(2.5)).toBe(false);
    expect(habilitarVentanaSchema.safeParse({ plazoDias: 5, secciones: [] }).success).toBe(false);
  });
  it("la prórroga exige fecha futura y motivo", () => {
    const futuro = new Date(Date.now() + 86_400_000).toISOString();
    expect(
      prorrogaSchema.safeParse({ nuevaFechaFin: futuro, motivo: "Licencia médica" }).success,
    ).toBe(true);
    expect(
      prorrogaSchema.safeParse({ nuevaFechaFin: "2020-01-01T00:00", motivo: "x" }).success,
    ).toBe(false);
    expect(prorrogaSchema.safeParse({ nuevaFechaFin: futuro, motivo: "" }).success).toBe(false);
  });
  it("el rechazo total exige motivo", () => {
    expect(rechazoSchema.safeParse({ motivo: "" }).success).toBe(false);
    expect(rechazoSchema.safeParse({ motivo: "Soporte ilegible" }).success).toBe(true);
  });
});
