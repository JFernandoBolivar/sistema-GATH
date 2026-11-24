import { describe, expect, it } from "vitest";
import { ventana2Legible } from "./ventana2-legible";

describe("Ventana 2 legible para Captación", () => {
  it("sin datos es vacía", () => {
    expect(ventana2Legible(null).vacia).toBe(true);
  });
  it("dibuja familiares, vivienda, salud y tallas con nombres", () => {
    const v = ventana2Legible({
      sin_familiares: false,
      familiares: [{ primer_nombre: "Ana", primer_apellido: "Pérez", parentesco: { id: 1, nombre: "Hijo(a)" }, sexo: { id: 1, nombre: "Femenino" }, fecha_nacimiento: "2020-01-01", orden_hijo: 1, depende_economicamente: true }],
      vivienda: { direccion_exacta: "Calle 1", estado: { id: 1, nombre: "Miranda" }, municipio: { id: 2, nombre: "Sucre" }, parroquia: { id: 3, nombre: "Petare" }, condicion_vivienda: { id: 1, nombre: "Propia" } },
      salud: { grupo_sanguineo: { id: 1, nombre: "O+" }, alergias: [], patologias_cronicas: [{ id: 1, nombre: "Asma" }], discapacidades: [] },
      tallas: { camisa: { id: 1, valor: "M", region: "VE" }, pantalon: null, calzado: { id: 3, valor: "42", region: "VE" }, chaqueta: null },
    });
    expect(v.familiares[0].titulo).toBe("Ana Pérez");
    expect(v.familiares[0].filas).toContainEqual({ etiqueta: "Cédula", valor: "Sin cédula (hijo N.º 1)" });
    expect(v.vivienda).toContainEqual({ etiqueta: "Parroquia", valor: "Petare" });
    expect(v.salud).toContainEqual({ etiqueta: "Alergias", valor: "Ninguna" });
    expect(v.salud).toContainEqual({ etiqueta: "Enfermedades crónicas", valor: "Asma" });
    expect(v.tallas).toContainEqual({ etiqueta: "Camisa", valor: "M (VE)" });
    expect(v.tallas).toContainEqual({ etiqueta: "Pantalón", valor: "No informado" });
  });

  it("dibuja estudios, cursos, experiencia, idiomas y RIF (F-8)", () => {
    const v = ventana2Legible({
      estudios: [{ nivel_academico: { id: 1, nombre: "Universitario" }, carrera: { id: 2, nombre: "Ingeniería" }, mencion: null, institucion: { id: 4, nombre: "UCV" } }],
      cursos: [{ capacitacion: { id: 5, nombre: "Gerencia pública" }, institucion: { id: 4, nombre: "UCV" }, fecha_inicio: "2023-02-01", horas: 40 }],
      antecedentes: [{ organismo: { id: 6, nombre: "SENIAT" }, fecha_ingreso: "2015-01-05", fecha_egreso: "2020-12-31" }],
      trabajo_antes_en_conatel: false,
      idiomas: [{ idioma_id: 7, nombre: "Inglés", nivel: "BIEN" }, { otro_idioma: "Guaraní", nombre: "Guaraní", nivel: "POCO" }],
      rif: "V-12345678-9",
    });
    expect(v.estudios[0].titulo).toBe("Universitario");
    expect(v.estudios[0].filas).toContainEqual({ etiqueta: "Carrera", valor: "Ingeniería" });
    expect(v.estudios[0].filas).toContainEqual({ etiqueta: "Mención", valor: "No informado" });
    expect(v.cursos[0].filas).toContainEqual({ etiqueta: "Horas", valor: "40" });
    expect(v.cursos[0].filas.find((f) => f.etiqueta === "Inicio")?.valor).toMatch(/2023/);
    expect(v.cursos[0].filas).toContainEqual({ etiqueta: "Fin", valor: "No informado" });
    expect(v.antecedentes[0].titulo).toBe("SENIAT");
    expect(v.trabajoAntesEnConatel).toBe("No");
    expect(v.idiomas.map((i) => [i.titulo, i.filas[0].valor])).toEqual([["Inglés", "Bien"], ["Guaraní", "Poco"]]);
    expect(v.rif).toBe("V-12345678-9");
  });

  it("un borrador anterior a F-8 no rompe el detalle", () => {
    const v = ventana2Legible({ familiares: [], sin_cursos: true });
    expect(v.estudios).toEqual([]);
    expect(v.sinCursos).toBe(true);
    expect([v.rif, v.trabajoAntesEnConatel, v.idiomas.length]).toEqual(["", "", 0]);
  });
});
