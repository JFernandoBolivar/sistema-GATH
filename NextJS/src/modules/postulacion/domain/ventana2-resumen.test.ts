import { describe, expect, it } from "vitest";
import { CATALOGOS_VACIOS } from "./ventana2";
import { resumirVentana2 } from "./ventana2-resumen";

describe("resumen legible de la Ventana 2", () => {
  const c = {
    ...CATALOGOS_VACIOS,
    parentescos: [{ id: 1, nombre: "Hijo(a)", esHijo: true, menorACargo: false, sinCedulaHastaEdad: 9, permiteOrdenHijo: true }],
    alergias: [{ id: 5, nombre: "Polen" }],
    gruposSanguineos: [{ id: 2, nombre: "O+" }],
  };
  it("sustituye ids por nombres y describe al familiar", () => {
    const r = resumirVentana2(
      { familiares: [{ primer_nombre: "Ana", primer_apellido: "Pérez", parentesco_id: 1, fecha_nacimiento: "2021-01-01", orden_hijo: 1, depende_economicamente: true }], salud: { grupo_sanguineo_id: 2, alergias: [5] } },
      c,
      new Date("2026-11-24T12:00:00Z"),
    );
    expect(r.familiares[0]).toEqual({ titulo: "Ana Pérez", detalle: "Hijo(a) · 5 años · sin cédula, hijo N.º 1 · depende de ti" });
    expect(r.salud).toContainEqual({ etiqueta: "Grupo sanguíneo", valor: "O+" });
    expect(r.salud).toContainEqual({ etiqueta: "Alergias", valor: "Polen" });
    expect(r.salud).toContainEqual({ etiqueta: "Discapacidades", valor: "Ninguna" });
  });

  it("resume estudios, cursos, experiencia, idiomas y RIF con nombres", () => {
    const cat = {
      ...c,
      nivelesAcademicos: [{ id: 1, nombre: "Universitario" }],
      carreras: [{ id: 2, nombre: "Ingeniería", nivelAcademicoId: 1 }],
      menciones: [{ id: 3, nombre: "Redes", carreraId: 2 }],
      instituciones: [{ id: 4, nombre: "UCV" }],
      capacitaciones: [{ id: 5, nombre: "Gerencia pública" }],
      organismos: [{ id: 6, nombre: "SENIAT" }],
      idiomas: [{ id: 7, nombre: "Inglés" }],
    };
    const r = resumirVentana2(
      {
        estudios: [{ nivel_academico_id: 1, carrera_id: 2, mencion_id: 3, institucion_id: 4 }],
        cursos: [{ capacitacion_id: 5, institucion_id: 4, fecha_inicio: "2023-02-01", fecha_fin: "2023-03-01", horas: 40 }],
        antecedentes: [{ organismo_id: 6, fecha_ingreso: "2015-01-05", fecha_egreso: "2020-12-31" }],
        trabajo_antes_en_conatel: false,
        idiomas: [{ idioma_id: 7, nivel: "BIEN" }, { otro_idioma: "Guaraní", nivel: "POCO" }],
        rif: "V-12345678-9",
      },
      cat,
      new Date("2026-11-24T12:00:00Z"),
    );
    expect(r.estudios).toEqual([{ titulo: "Universitario", detalle: "Ingeniería · Redes · UCV" }]);
    expect(r.cursos).toEqual([{ titulo: "Gerencia pública", detalle: "UCV · 01/02/2023 al 01/03/2023 · 40 h" }]);
    expect(r.antecedentes).toEqual([{ titulo: "SENIAT", detalle: "05/01/2015 al 31/12/2020" }]);
    expect(r.trabajoAntesEnConatel).toBe("No");
    expect(r.idiomas).toEqual([{ titulo: "Inglés", detalle: "Bien" }, { titulo: "Guaraní", detalle: "Poco" }]);
    expect(r.rif).toBe("V-12345678-9");
  });

  it("un borrador anterior a F-8 se resume sin error y con las declaraciones «no tengo»", () => {
    const r = resumirVentana2({ sin_cursos: true, sin_antecedentes: true, sin_idiomas: true }, c, new Date("2026-11-24T12:00:00Z"));
    expect(r.estudios).toEqual([]);
    expect([r.sinCursos, r.sinAntecedentes, r.sinIdiomas, r.rif, r.trabajoAntesEnConatel]).toEqual([true, true, true, "", ""]);
    expect(resumirVentana2({}, c, new Date()).idiomas).toEqual([]);
  });
});
