import { describe, expect, it } from "vitest";

import type { Bloque, DefinicionOverlay } from "../entities/plantilla";
import {
  actualizarBloque,
  actualizarCampoEnPagina,
  duplicarBloque,
  duplicarCampo,
  duplicarPagina,
  eliminarBloque,
  insertarBloque,
  moverBloque,
  moverPagina,
  reordenarBloques,
} from "./bloques";
import { nuevoBloque, nuevoCampoOverlay, claveDesdeEtiqueta } from "./factorias";
import { CATALOGO } from "./fixtures";

const lista: Bloque[] = [
  { id: "b1", tipo: "seccion", titulo: "A" },
  { id: "b2", tipo: "seccion", titulo: "B" },
  { id: "b3", tipo: "salto_pagina" },
];
const ids = (l: Bloque[]) => l.map((b) => b.id);

describe("bloques", () => {
  it("reordena y limita el índice", () => {
    expect(ids(reordenarBloques(lista, "b1", 2))).toEqual(["b2", "b3", "b1"]);
    expect(ids(reordenarBloques(lista, "b3", 0))).toEqual(["b3", "b1", "b2"]);
    expect(ids(reordenarBloques(lista, "b1", 99))).toEqual(["b2", "b3", "b1"]);
    expect(reordenarBloques(lista, "zz", 0)).toBe(lista);
  });
  it("mueve arriba/abajo y no pasa de los extremos", () => {
    expect(ids(moverBloque(lista, "b2", -1))).toEqual(["b2", "b1", "b3"]);
    expect(moverBloque(lista, "b1", -1)).toBe(lista);
    expect(moverBloque(lista, "b3", 1)).toBe(lista);
  });
  it("duplica con id nuevo y copia profunda", () => {
    const fila: Bloque[] = [{ id: "b1", tipo: "fila_campos", alto_mm: 12, celdas: [{ etiqueta: "a", variable: null, ancho: 12 }] }];
    const r = duplicarBloque(fila, "b1");
    expect(ids(r.lista)).toEqual(["b1", "b2"]);
    const copia = r.lista[1] as Extract<Bloque, { tipo: "fila_campos" }>;
    copia.celdas[0].etiqueta = "z";
    expect((fila[0] as typeof copia).celdas[0].etiqueta).toBe("a");
  });
  it("actualiza sin mutar y sin cambiar id ni tipo", () => {
    const r = actualizarBloque(lista, "b1", { titulo: "N", id: "x", tipo: "salto_pagina" } as Partial<Bloque>);
    expect(r[0]).toEqual({ id: "b1", tipo: "seccion", titulo: "N" });
    expect(lista[0]).toEqual({ id: "b1", tipo: "seccion", titulo: "A" });
  });
  it("inserta tras el seleccionado o al final y elimina", () => {
    const n = nuevoBloque("foto", lista);
    expect(n.id).toBe("b4");
    expect(ids(insertarBloque(lista, n, "b1"))).toEqual(["b1", "b4", "b2", "b3"]);
    expect(ids(insertarBloque(lista, n, null))).toEqual(["b1", "b2", "b3", "b4"]);
    expect(ids(eliminarBloque(lista, "b2"))).toEqual(["b1", "b3"]);
  });
  it("la tabla nueva toma la primera colección del catálogo", () => {
    const t = nuevoBloque("tabla", [], CATALOGO);
    expect(t.tipo === "tabla" && t.coleccion).toBe("familiares");
  });
  it("genera claves válidas de campo propio", () => {
    expect(claveDesdeEtiqueta("Fecha de ingreso estimada")).toBe("fecha_de_ingreso_estimada");
    expect(claveDesdeEtiqueta("1 año")).toMatch(/^[a-z][a-z0-9_]*$/);
  });
});

describe("overlay", () => {
  const def: DefinicionOverlay = { paginas: [{ origen: 1, campos: [nuevoCampoOverlay("texto", [], { x: 5, y: 5 })] }, { origen: 2, campos: [] }] };
  it("duplica un campo con id único global y desplazado", () => {
    const r = duplicarCampo(def, 0, "c1");
    expect(r.nuevoId).toBe("c2");
    expect(r.definicion.paginas[0].campos[1].x).toBe(8);
  });
  it("actualiza un campo de una página", () => {
    const r = actualizarCampoEnPagina(def, 0, "c1", { x: 40 });
    expect(r.paginas[0].campos[0].x).toBe(40);
    expect(def.paginas[0].campos[0].x).toBe(5);
  });
  it("mueve y duplica páginas", () => {
    expect(moverPagina(def, 0, 1).paginas.map((p) => p.origen)).toEqual([2, 1]);
    const d = duplicarPagina(def, 0);
    expect(d.paginas).toHaveLength(3);
    expect(d.paginas[1].campos[0].id).not.toBe("c1");
  });
});
