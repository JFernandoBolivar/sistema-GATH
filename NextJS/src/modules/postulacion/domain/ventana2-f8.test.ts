import { describe, expect, it } from "vitest";
import {
  calcularAvance,
  campoDeRutaApi,
  cuerpoCursos,
  cuerpoEstudios,
  cuerpoExperiencia,
  cuerpoIdiomas,
  cursosDesdeDatos,
  estudiosDesdeDatos,
  experienciaDesdeDatos,
  idiomasDesdeDatos,
  normalizarRif,
  OTRO_IDIOMA,
  SECCIONES_VENTANA2,
  seccionDeFaltante,
} from "./ventana2";
import { mapearCatalogosVentana2 } from "../infrastructure/mappers/mapper-postulacion";

describe("Ventana 2 ampliada (F-8): secciones y avance", () => {
  it("las secciones nuevas están entre las tallas y la foto, y el backend las llama estudios, cursos, antecedentes e idiomas", () => {
    expect(SECCIONES_VENTANA2.map((s) => s.id)).toEqual([
      "familiares", "vivienda", "salud", "tallas", "estudios", "cursos", "experiencia", "idiomas", "foto", "revisar",
    ]);
    expect(SECCIONES_VENTANA2.find((s) => s.id === "experiencia")?.seccionApi).toBe("antecedentes");
  });

  it("un faltante de estudios deja esa sección incompleta y el resto completa", () => {
    const a = calcularAvance([{ seccion: "estudios", campo: "estudios", mensaje: "Registre al menos un estudio" }]);
    expect(a.secciones.filter((s) => !s.completa).map((s) => s.id)).toEqual(["estudios"]);
    expect(seccionDeFaltante({ seccion: "antecedentes", campo: "antecedentes.0.fecha_egreso", mensaje: "" })).toBe("experiencia");
  });
});

describe("RIF", () => {
  it.each([
    ["V-12345678-9", "V-12345678-9"],
    ["v123456789", "V-12345678-9"],
    [" j 30123456 7 ", "J-30123456-7"],
    ["P-1234567-1", "P-01234567-1"],
    ["", ""],
    ["   ", ""],
  ])("normaliza %j a %j", (entrada, esperado) => {
    expect(normalizarRif(entrada)).toBe(esperado);
  });
  it.each(["12345678-9", "X-12345678-9", "V-123-9", "V-ABCD1234-5", "V-12345678901-2"])("rechaza %j", (entrada) => {
    expect(normalizarRif(entrada)).toBeNull();
  });
});

describe("datos <-> formulario de las secciones nuevas", () => {
  it("estudios: ids como texto y cuerpo sin vacíos", () => {
    const v = estudiosDesdeDatos({ estudios: [{ nivel_academico_id: 3, carrera_id: 5, institucion_id: 9 }] });
    expect(v.estudios[0]).toEqual({ nivelAcademicoId: "3", carreraId: "5", mencionId: "", institucionId: "9" });
    expect(cuerpoEstudios(v)).toEqual({ estudios: [{ nivel_academico_id: 3, carrera_id: 5, institucion_id: 9 }] });
    expect(estudiosDesdeDatos({}).estudios).toEqual([]);   // un borrador anterior a F-8
  });

  it("cursos: «no tengo» vacía la lista; con cursos manda fechas y horas", () => {
    const v = cursosDesdeDatos({ cursos: [{ capacitacion_id: 2, institucion_id: 7, fecha_inicio: "2023-01-10", horas: 40 }] });
    expect(v).toMatchObject({ sinCursos: false, cursos: [{ capacitacionId: "2", institucionId: "7", fechaInicio: "2023-01-10", fechaFin: "", horas: "40" }] });
    expect(cuerpoCursos(v)).toEqual({ sin_cursos: false, cursos: [{ capacitacion_id: 2, institucion_id: 7, fecha_inicio: "2023-01-10", horas: 40 }] });
    expect(cuerpoCursos({ sinCursos: true, cursos: v.cursos })).toEqual({ sin_cursos: true, cursos: [] });
  });

  it("experiencia: la pregunta de CONATEL solo viaja si se respondió", () => {
    const v = experienciaDesdeDatos({ trabajo_antes_en_conatel: false, antecedentes: [{ organismo_id: 4, fecha_ingreso: "2010-01-01", fecha_egreso: "2012-06-30" }] });
    expect(v.trabajoAntesEnConatel).toBe("no");
    expect(cuerpoExperiencia(v)).toEqual({
      sin_antecedentes: false, trabajo_antes_en_conatel: false,
      antecedentes: [{ organismo_id: 4, fecha_ingreso: "2010-01-01", fecha_egreso: "2012-06-30" }],
    });
    expect(cuerpoExperiencia({ ...v, trabajoAntesEnConatel: "" })).not.toHaveProperty("trabajo_antes_en_conatel");
    expect(cuerpoExperiencia({ ...v, sinAntecedentes: true })).toMatchObject({ sin_antecedentes: true, antecedentes: [] });
  });

  it("idiomas: catálogo u «otro», nivel y RIF normalizado", () => {
    const v = idiomasDesdeDatos({ idiomas: [{ idioma_id: 1, nivel: "BIEN" }, { otro_idioma: "Guaraní", nivel: "POCO" }], rif: "V-12345678-9" });
    expect(v.idiomas).toEqual([
      { idiomaId: "1", otroIdioma: "", nivel: "BIEN" },
      { idiomaId: OTRO_IDIOMA, otroIdioma: "Guaraní", nivel: "POCO" },
    ]);
    expect(cuerpoIdiomas({ ...v, rif: "v-1234567-8" })).toEqual({
      rif: "V-01234567-8", sin_idiomas: false,
      idiomas: [{ idioma_id: 1, nivel: "BIEN" }, { otro_idioma: "Guaraní", nivel: "POCO" }],
    });
    expect(cuerpoIdiomas({ sinIdiomas: true, idiomas: v.idiomas, rif: "" })).toEqual({ rif: "", sin_idiomas: true, idiomas: [] });
  });
});

describe("errores del servidor de las secciones nuevas", () => {
  it.each([
    ["estudios.0.nivel_academico_id", "estudios", "estudios.0.nivelAcademicoId"],
    ["datos_ventana2.cursos.2.fecha_fin", "cursos", "cursos.2.fechaFin"],
    ["antecedentes.1.organismo_id", "experiencia", "antecedentes.1.organismoId"],
    ["idiomas.0.otro_idioma", "idiomas", "idiomas.0.otroIdioma"],
    ["idiomas", "idiomas", "idiomas"],
    ["sin_cursos", "cursos", "cursos"],
    ["rif", "idiomas", "rif"],
    ["datos_ventana2.rif", "idiomas", "rif"],
    ["trabajo_antes_en_conatel", "experiencia", "trabajoAntesEnConatel"],
    ["familiares.0.cedula", "familiares", "familiares.0.cedula"],
  ])("%s", (ruta, seccion, campo) => {
    expect(campoDeRutaApi(ruta)).toEqual({ seccion, campo });
  });
});

describe("catálogos de la Ventana 2 ampliada", () => {
  it("mapea niveles, carreras con su nivel, menciones con su carrera, instituciones, cursos, organismos e idiomas", () => {
    const c = mapearCatalogosVentana2({
      niveles_academicos: [{ id: 1, nombre: "TSU" }],
      carreras: [{ id: 2, nombre: "Informática", nivel_academico_id: 1 }, { id: 3, nombre: "Otra", nivel_academico_id: null }],
      menciones: [{ id: 4, nombre: "Redes", carrera_id: 2 }],
      instituciones: [{ id: 5, nombre: "UCV" }], capacitaciones: [{ id: 6, nombre: "Gerencia" }],
      organismos: [{ id: 7, nombre: "SENIAT" }], idiomas: [{ id: 8, nombre: "Inglés" }],
    });
    expect(c.carreras).toEqual([{ id: 2, nombre: "Informática", nivelAcademicoId: 1 }, { id: 3, nombre: "Otra", nivelAcademicoId: null }]);
    expect(c.menciones).toEqual([{ id: 4, nombre: "Redes", carreraId: 2 }]);
    expect([c.nivelesAcademicos, c.instituciones, c.capacitaciones, c.organismos, c.idiomas].map((l) => l[0].nombre)).toEqual(["TSU", "UCV", "Gerencia", "SENIAT", "Inglés"]);
    expect(mapearCatalogosVentana2({}).idiomas).toEqual([]);   // respuesta sin las claves nuevas
  });
});
