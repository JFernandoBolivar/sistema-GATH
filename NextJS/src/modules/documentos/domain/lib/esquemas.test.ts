import { describe, expect, it } from "vitest";

import type { CampoPropio, DefinicionFormulario, DefinicionOverlay } from "../entities/plantilla";
import { validarBorrador } from "./esquemas";
import { CATALOGO } from "./fixtures";
import { contextoDeVariables } from "./variables";

const propios: CampoPropio[] = [{ clave: "cargo_p", etiqueta: "Cargo", tipo: "texto", obligatorio: false, ayuda: "" }];
const ctx = contextoDeVariables(CATALOGO, propios);
const base = (bloques: DefinicionFormulario["bloques"]): DefinicionFormulario => ({
  pagina: { tamano: "carta", orientacion: "vertical" },
  encabezado: { tipo: "institucional", titulo: "T", subtitulo: "" },
  bloques,
});
const validar = (def: unknown, p = propios) => validarBorrador({ modo: "formulario", definicion: def, campos_propios: p }, ctx);

describe("esquema formulario", () => {
  it("acepta una definición válida con variable propia y celda en blanco", () => {
    const def = base([
      { id: "b1", tipo: "seccion", titulo: "Datos" },
      { id: "b2", tipo: "fila_campos", alto_mm: 12, celdas: [{ etiqueta: "N", variable: "nombres", ancho: 6 }, { etiqueta: "C", variable: "propio.cargo_p", ancho: 3 }, { etiqueta: "x", variable: null, ancho: 3 }] },
      { id: "b3", tipo: "parrafo", texto: "Hola {nombres}", alineacion: "justificado" },
    ]);
    expect(validar(def)).toEqual([]);
  });

  it("rechaza una colección en una celda y señala la ruta", () => {
    const def = base([{ id: "b1", tipo: "fila_campos", alto_mm: 12, celdas: [{ etiqueta: "F", variable: "familiares", ancho: 6 }] }]);
    expect(validar(def)[0].ruta).toBe("bloques.0.celdas.0.variable");
  });

  it("rechaza una columna que no es de la colección", () => {
    const def = base([{ id: "b1", tipo: "tabla", titulo: "F", coleccion: "familiares", filas_minimas: 2, columnas: [{ variable: "cedula", etiqueta: "x", ancho: 2 }] }]);
    expect(validar(def)[0].ruta).toBe("bloques.0.columnas.0.variable");
  });

  it("detecta variables desconocidas en párrafos, ids repetidos y casillas sin variable", () => {
    const def = base([
      { id: "b1", tipo: "parrafo", texto: "{inexistente}", alineacion: "izquierda" },
      { id: "b1", tipo: "casillas", etiqueta: "", variable: "", columnas: 2, opciones: [{ valor: "A", etiqueta: "a" }] },
    ]);
    const rutas = validar(def).map((e) => e.ruta);
    expect(rutas).toContain("bloques.0.texto");
    expect(rutas).toContain("bloques.1.id");
    expect(rutas).toContain("bloques.1.variable");
  });

  it("valida rangos (ancho 1..12) y número de celdas", () => {
    const def = base([{ id: "b1", tipo: "fila_campos", alto_mm: 2, celdas: [{ etiqueta: "a", variable: null, ancho: 13 }] }]);
    const rutas = validar(def).map((e) => e.ruta);
    expect(rutas).toContain("bloques.0.alto_mm");
    expect(rutas).toContain("bloques.0.celdas.0.ancho");
  });

  it("valida los campos propios (clave inválida, repetida, opción sin opciones)", () => {
    const malos: CampoPropio[] = [
      { clave: "Mala", etiqueta: "x", tipo: "texto", obligatorio: false, ayuda: "" },
      { clave: "ok", etiqueta: "x", tipo: "opcion", obligatorio: false, ayuda: "" },
      { clave: "ok", etiqueta: "y", tipo: "texto", obligatorio: false, ayuda: "" },
    ];
    const rutas = validar(base([]), malos).map((e) => e.ruta);
    expect(rutas).toContain("campos_propios.0.clave");
    expect(rutas).toContain("campos_propios.1.opciones");
    expect(rutas).toContain("campos_propios.2.clave");
  });
});

describe("esquema overlay", () => {
  const pag = [{ numero: 1, ancho_pt: 612, alto_pt: 792, ancho_mm: 216, alto_mm: 279 }];
  const val = (def: DefinicionOverlay, fondo = pag) => validarBorrador({ modo: "pdf_overlay", definicion: def, campos_propios: [] }, ctx, fondo);
  const texto = { id: "c1", tipo: "texto" as const, x: 10, y: 10, w: 50, h: 6, texto: "{nombres}", tamano: 9, alineacion: "izquierda" as const, negrita: false };

  it("acepta campos válidos", () => {
    expect(val({ paginas: [{ origen: 1, campos: [texto, { id: "c2", tipo: "casilla", x: 1, y: 1, w: 4, h: 4, condicion: { variable: "sexo", operador: "igual", valor: "MASCULINO" } }] }] })).toEqual([]);
  });

  it("exige PDF de fondo, página de origen existente y campo dentro de la página", () => {
    expect(val({ paginas: [{ origen: 1, campos: [] }] }, [])[0].ruta).toBe("paginas");
    expect(val({ paginas: [{ origen: 5, campos: [] }] })[0].ruta).toBe("paginas.0.origen");
    expect(val({ paginas: [{ origen: 1, campos: [{ ...texto, x: 300 }] }] })[0].ruta).toBe("paginas.0.campos.0.x");
  });

  it("valida condición de casilla y tamaño de letra", () => {
    const rutas = val({ paginas: [{ origen: 1, campos: [{ ...texto, tamano: 40 }, { id: "c2", tipo: "casilla", x: 1, y: 1, w: 4, h: 4, condicion: { variable: "sexo", operador: "igual", valor: "" } }] }] }).map((e) => e.ruta);
    expect(rutas).toContain("paginas.0.campos.0.tamano");
    expect(rutas).toContain("paginas.0.campos.1.condicion.valor");
  });

  it("tabla: columna ajena a la colección", () => {
    const t = { id: "c3", tipo: "tabla" as const, x: 1, y: 1, w: 100, h: 30, coleccion: "familiares", columnas: [{ variable: "zzz", dx: 0, ancho: 20, alineacion: "izquierda" as const }], interlineado: 6, filas_max: 5, tamano: 8 };
    expect(val({ paginas: [{ origen: 1, campos: [t] }] })[0].ruta).toBe("paginas.0.campos.0.columnas.0.variable");
  });
});
