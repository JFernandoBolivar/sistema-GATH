import { describe, expect, it } from "vitest";

import type { CampoPropio } from "../entities/plantilla";
import { firmaEstable, hayCambiosSinGuardar } from "./cambios";
import { ubicarError } from "./errores";
import { CATALOGO } from "./fixtures";
import {
  agruparVariables,
  columnasDeColeccion,
  extraerVariables,
  filtrarVariables,
  insertarVariableEnTexto,
  opcionesSugeridas,
  variablesDisponibles,
} from "./variables";

const propios: CampoPropio[] = [{ clave: "ingreso", etiqueta: "Fecha de ingreso", tipo: "fecha", obligatorio: true, ayuda: "" }];

describe("variables", () => {
  it("suma los campos propios al catálogo en su grupo", () => {
    const todas = variablesDisponibles(CATALOGO, propios);
    const p = todas.find((v) => v.clave === "propio.ingreso");
    expect(p).toMatchObject({ grupo: "Campos propios del documento", tipo: "fecha" });
    expect(agruparVariables(todas).map((g) => g.grupo)).toEqual(["Identificación", "Colecciones", "Campos propios del documento"]);
  });
  it("filtra escalares y colecciones", () => {
    const esc = variablesDisponibles(CATALOGO, propios, { soloEscalares: true }).map((v) => v.clave);
    expect(esc).toContain("propio.ingreso");
    expect(esc).not.toContain("familiares");
    expect(esc).not.toContain("foto");
    expect(variablesDisponibles(CATALOGO, [], { soloColecciones: true }).map((v) => v.clave)).toEqual(["familiares"]);
  });
  it("busca sin acentos ni mayúsculas", () => {
    expect(filtrarVariables(variablesDisponibles(CATALOGO, []), "IDENTIFICACION")).toHaveLength(4);
    expect(filtrarVariables(variablesDisponibles(CATALOGO, []), "nacim").map((v) => v.clave)).toEqual(["fecha_nacimiento"]);
  });
  it("extrae variables sin repetir e inserta en el cursor", () => {
    expect(extraerVariables("{nombres} {propio.ingreso} {nombres} {Mala}")).toEqual(["nombres", "propio.ingreso"]);
    expect(insertarVariableEnTexto("Hola ", "nombres", 5, 5)).toEqual({ texto: "Hola {nombres}", cursor: 14 });
    expect(insertarVariableEnTexto("Hola XX!", "a", 5, 7).texto).toBe("Hola {a}!");
  });
  it("columnas de colección y opciones sugeridas", () => {
    expect(columnasDeColeccion(CATALOGO, "familiares").map((c) => c.clave)).toEqual(["nombre_completo", "parentesco"]);
    expect(opcionesSugeridas("sexo", CATALOGO, []).map((o) => o.valor)).toEqual(["MASCULINO", "FEMENINO"]);
    expect(opcionesSugeridas("propio.x", CATALOGO, [{ clave: "x", etiqueta: "x", tipo: "opcion", obligatorio: false, ayuda: "", opciones: ["A", "B"] }])).toHaveLength(2);
    expect(opcionesSugeridas("nombres", CATALOGO, [])).toEqual([]);
  });
});

describe("cambios sin guardar", () => {
  it("compara estructuralmente sin importar el orden de claves", () => {
    expect(firmaEstable({ a: 1, b: { c: 2, d: [1, { z: 1, y: 2 }] } })).toBe(firmaEstable({ b: { d: [1, { y: 2, z: 1 }], c: 2 }, a: 1 }));
    expect(hayCambiosSinGuardar({ a: 1 }, { a: 1 })).toBe(false);
    expect(hayCambiosSinGuardar({ a: 2 }, { a: 1 })).toBe(true);
    expect(hayCambiosSinGuardar({ a: 1 }, null)).toBe(false);
  });
});

describe("ubicación de errores", () => {
  it("normaliza `definicion.` y ubica bloque o campo", () => {
    const f = { pagina: { tamano: "carta", orientacion: "vertical" }, encabezado: { tipo: "ninguno", titulo: "", subtitulo: "" }, bloques: [{ id: "x", tipo: "salto_pagina" }, { id: "y", tipo: "salto_pagina" }] } as never;
    expect(ubicarError("bloques.1.celdas.0.variable", "formulario", f)).toEqual({ bloqueId: "y" });
    expect(ubicarError("definicion.encabezado.tipo", "formulario", f)).toEqual({ ajustes: true });
    const o = { paginas: [{ origen: 1, campos: [{ id: "c1" }] }] } as never;
    expect(ubicarError("definicion.paginas.0.campos.0.x", "pdf_overlay", o)).toEqual({ paginaIdx: 0, campoId: "c1" });
    expect(ubicarError("campos_propios.2.clave", "formulario", f)).toEqual({ campoPropioIdx: 2 });
  });
});
