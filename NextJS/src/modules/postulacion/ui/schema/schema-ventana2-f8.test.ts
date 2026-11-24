import { describe, expect, it } from "vitest";
import { ANTECEDENTE_VACIO, CURSO_VACIO, ESTUDIO_VACIO, IDIOMA_VACIO } from "../../domain/ventana2";
import {
  crearEsquemaCursos,
  crearEsquemaEstudios,
  crearEsquemaExperiencia,
  crearEsquemaIdiomas,
  problemaDeFechaPasada,
} from "./schema-ventana2";

const HOY = new Date("2026-11-24T12:00:00Z");
const mensajes = (r: { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } }) =>
  r.success ? [] : (r.error?.issues.map((i) => `${i.path.join(".")}: ${i.message}`) ?? []);

describe("esquema de estudios", () => {
  const estricto = crearEsquemaEstudios({ estricto: true });
  const flexible = crearEsquemaEstudios({ estricto: false });

  it("al continuar exige al menos un estudio y el nivel de cada uno", () => {
    expect(mensajes(estricto.safeParse({ estudios: [] })).join("|")).toMatch(/estudios: Agrega al menos un estudio/);
    expect(mensajes(estricto.safeParse({ estudios: [{ ...ESTUDIO_VACIO, carreraId: "3" }] })).join("|")).toMatch(/estudios\.0\.nivelAcademicoId: Elige el nivel/);
    expect(estricto.safeParse({ estudios: [{ ...ESTUDIO_VACIO, nivelAcademicoId: "2" }] }).success).toBe(true);
  });
  it("al guardar avance se admite incompleto, pero no más de 10", () => {
    expect(flexible.safeParse({ estudios: [] }).success).toBe(true);
    expect(flexible.safeParse({ estudios: [ESTUDIO_VACIO] }).success).toBe(true);
    expect(mensajes(flexible.safeParse({ estudios: Array.from({ length: 11 }, () => ESTUDIO_VACIO) })).join("|")).toMatch(/máximo 10/);
  });
});

describe("esquema de cursos", () => {
  const estricto = crearEsquemaCursos({ estricto: true, hoy: HOY });
  const flexible = crearEsquemaCursos({ estricto: false, hoy: HOY });
  const curso = { ...CURSO_VACIO, capacitacionId: "1", institucionId: "2" };

  it("es opcional: sin cursos ni declaración también es válido", () => {
    expect(estricto.safeParse({ sinCursos: false, cursos: [] }).success).toBe(true);
    expect(estricto.safeParse({ sinCursos: true, cursos: [] }).success).toBe(true);
  });
  it("«no tengo cursos» no se mezcla con cursos", () => {
    expect(mensajes(flexible.safeParse({ sinCursos: true, cursos: [curso] })).join("|")).toMatch(/sinCursos: Quita los cursos/);
  });
  it("cada curso exige el curso y la institución al continuar", () => {
    expect(mensajes(estricto.safeParse({ sinCursos: false, cursos: [CURSO_VACIO] })).join("|")).toMatch(/cursos\.0\.capacitacionId.*cursos\.0\.institucionId/);
    expect(flexible.safeParse({ sinCursos: false, cursos: [CURSO_VACIO] }).success).toBe(true);
  });
  it("valida fechas (no futuras, fin >= inicio) y horas", () => {
    const m = (c: object) => mensajes(flexible.safeParse({ sinCursos: false, cursos: [{ ...curso, ...c }] })).join("|");
    expect(m({ fechaInicio: "2030-01-01" })).toMatch(/fechaInicio: .*futura/);
    expect(m({ fechaInicio: "2023-05-01", fechaFin: "2023-04-01" })).toMatch(/fechaFin: .*anterior/);
    expect(m({ fechaFin: "2023-02-31" })).toMatch(/fechaFin: Escribe una fecha válida/);
    expect(m({ horas: "0" })).toMatch(/horas/);
    expect(m({ horas: "10000" })).toMatch(/horas/);
    expect(m({ horas: "4x" })).toMatch(/horas/);
    expect(m({ fechaInicio: "2023-01-10", fechaFin: "2023-02-10", horas: "40" })).toBe("");
  });
  it("máximo 30", () => {
    expect(mensajes(flexible.safeParse({ sinCursos: false, cursos: Array.from({ length: 31 }, () => curso) })).join("|")).toMatch(/máximo 30/);
  });
});

describe("esquema de experiencia en la Administración Pública", () => {
  const estricto = crearEsquemaExperiencia({ estricto: true, hoy: HOY });
  const flexible = crearEsquemaExperiencia({ estricto: false, hoy: HOY });
  const base = { sinAntecedentes: false, trabajoAntesEnConatel: "" as const };
  const ant = { organismoId: "1", fechaIngreso: "2010-01-01", fechaEgreso: "2012-06-30" };

  it("es opcional y la pregunta de CONATEL puede quedar sin responder", () => {
    expect(estricto.safeParse({ ...base, antecedentes: [] }).success).toBe(true);
    expect(estricto.safeParse({ sinAntecedentes: true, trabajoAntesEnConatel: "no", antecedentes: [] }).success).toBe(true);
  });
  it("cada experiencia exige organismo y las dos fechas al continuar", () => {
    const m = mensajes(estricto.safeParse({ ...base, antecedentes: [ANTECEDENTE_VACIO] })).join("|");
    expect(m).toMatch(/organismoId.*fechaIngreso.*fechaEgreso/);
    expect(flexible.safeParse({ ...base, antecedentes: [ANTECEDENTE_VACIO] }).success).toBe(true);
  });
  it("el egreso no puede ser anterior al ingreso ni futuro", () => {
    expect(mensajes(flexible.safeParse({ ...base, antecedentes: [{ ...ant, fechaEgreso: "2009-01-01" }] })).join("|")).toMatch(/fechaEgreso: .*anterior/);
    expect(mensajes(flexible.safeParse({ ...base, antecedentes: [{ ...ant, fechaEgreso: "2030-01-01" }] })).join("|")).toMatch(/fechaEgreso: .*futura/);
    expect(estricto.safeParse({ ...base, antecedentes: [ant] }).success).toBe(true);
  });
  it("«no he trabajado» no se mezcla con experiencias", () => {
    expect(mensajes(flexible.safeParse({ ...base, sinAntecedentes: true, antecedentes: [ant] })).join("|")).toMatch(/sinAntecedentes/);
  });
  it("fechas de pasado", () => {
    expect(problemaDeFechaPasada("2026-11-25", HOY, "la fecha")).toMatch(/futura/);
    expect(problemaDeFechaPasada("2026-11-24", HOY, "la fecha")).toBeNull();
    expect(problemaDeFechaPasada("ayer", HOY, "la fecha")).toMatch(/válida/);
  });
});

describe("esquema de idiomas y RIF", () => {
  const estricto = crearEsquemaIdiomas({ estricto: true });
  const flexible = crearEsquemaIdiomas({ estricto: false });
  const base = { sinIdiomas: false, rif: "" };

  it("es opcional", () => {
    expect(estricto.safeParse({ ...base, idiomas: [] }).success).toBe(true);
    expect(estricto.safeParse({ sinIdiomas: true, idiomas: [], rif: "" }).success).toBe(true);
  });
  it("cada idioma exige idioma y nivel al continuar; «otro» exige el nombre", () => {
    expect(mensajes(estricto.safeParse({ ...base, idiomas: [IDIOMA_VACIO] })).join("|")).toMatch(/idiomaId: Elige el idioma.*nivel/);
    expect(mensajes(estricto.safeParse({ ...base, idiomas: [{ idiomaId: "otro", otroIdioma: "", nivel: "BIEN" }] })).join("|")).toMatch(/otroIdioma: Escribe el nombre/);
    expect(estricto.safeParse({ ...base, idiomas: [{ idiomaId: "otro", otroIdioma: "Guaraní", nivel: "POCO" }, { idiomaId: "1", otroIdioma: "", nivel: "BIEN" }] }).success).toBe(true);
    expect(flexible.safeParse({ ...base, idiomas: [IDIOMA_VACIO] }).success).toBe(true);
  });
  it("rechaza niveles desconocidos, repetidos y más de 15", () => {
    expect(mensajes(flexible.safeParse({ ...base, idiomas: [{ idiomaId: "1", otroIdioma: "", nivel: "ALTO" }] })).join("|")).toMatch(/nivel: Elige el nivel/);
    const dup = mensajes(flexible.safeParse({ ...base, idiomas: [{ idiomaId: "1", otroIdioma: "", nivel: "BIEN" }, { idiomaId: "1", otroIdioma: "", nivel: "POCO" }] }));
    expect(dup.join("|")).toMatch(/idiomas\.1\.idiomaId: Este idioma ya está/);
    const dupOtro = mensajes(flexible.safeParse({ ...base, idiomas: [{ idiomaId: "otro", otroIdioma: "Latín", nivel: "BIEN" }, { idiomaId: "otro", otroIdioma: "latín", nivel: "POCO" }] }));
    expect(dupOtro.join("|")).toMatch(/idiomas\.1\.otroIdioma: Este idioma ya está/);
    expect(mensajes(flexible.safeParse({ ...base, idiomas: Array.from({ length: 16 }, (_, i) => ({ idiomaId: String(i + 1), otroIdioma: "", nivel: "BIEN" })) })).join("|")).toMatch(/máximo 15/);
  });
  it("«no domino otros idiomas» no se mezcla con idiomas", () => {
    expect(mensajes(flexible.safeParse({ sinIdiomas: true, rif: "", idiomas: [{ idiomaId: "1", otroIdioma: "", nivel: "BIEN" }] })).join("|")).toMatch(/sinIdiomas/);
  });
  it("valida el formato del RIF solo si se escribió", () => {
    expect(flexible.safeParse({ ...base, rif: "V-12345678-9", idiomas: [] }).success).toBe(true);
    expect(flexible.safeParse({ ...base, rif: "v123456789", idiomas: [] }).success).toBe(true);
    expect(mensajes(flexible.safeParse({ ...base, rif: "12345", idiomas: [] })).join("|")).toMatch(/rif: Escribe un RIF válido/);
  });
});
