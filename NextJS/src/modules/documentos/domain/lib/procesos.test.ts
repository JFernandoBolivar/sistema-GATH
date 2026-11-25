import { describe, expect, it } from "vitest";

import type { CampoPropio, DefinicionFormulario, DefinicionOverlay, ProcesoPlantilla, VariableCatalogo } from "../entities/plantilla";
import { agruparProcesos, catalogoParaProceso, filtrarVariablesPorProceso, validarVariablesParaProceso } from "./procesos";
import { CATALOGO } from "./fixtures";

const variables: VariableCatalogo[] = [
  { clave: "nombres", etiqueta: "Nombres", descripcion: "", grupo: "Identificación", tipo: "texto", ejemplo: "" },
  { clave: "sexo", etiqueta: "Sexo", descripcion: "", grupo: "Identificación", tipo: "texto", ejemplo: "" },
  {
    clave: "familiares",
    etiqueta: "Familiares",
    descripcion: "",
    grupo: "Colecciones",
    tipo: "coleccion",
    ejemplo: [],
    columnas: [{ clave: "nombre", etiqueta: "Nombre", ejemplo: "" }],
  },
];

const ingreso: ProcesoPlantilla = {
  codigo: "ingreso",
  etiqueta: "Ingreso",
  descripcion: "Documentos de ingreso",
  grupo: "ingreso",
  grupos_variables: ["Identificación"],
};
const bajoDemanda: ProcesoPlantilla = {
  codigo: "bajo_demanda",
  etiqueta: "Bajo demanda",
  descripcion: "Documentos solicitados",
  grupo: "bajo_demanda",
  grupos_variables: ["Identificación", "Colecciones"],
};

const propios: CampoPropio[] = [
  { clave: "cargo", etiqueta: "Cargo", tipo: "texto", obligatorio: false, ayuda: "" },
];

function formulario(bloques: DefinicionFormulario["bloques"]): DefinicionFormulario {
  return {
    pagina: { tamano: "carta", orientacion: "vertical" },
    encabezado: { tipo: "institucional", titulo: "", subtitulo: "" },
    bloques,
  };
}

describe("procesos y variables", () => {
  it("agrupa procesos y filtra únicamente los grupos de variables permitidos", () => {
    expect(agruparProcesos([ingreso, bajoDemanda]).map((g) => [g.grupo, g.procesos.length])).toEqual([
      ["ingreso", 1],
      ["bajo_demanda", 1],
    ]);
    expect(filtrarVariablesPorProceso(variables, ingreso).map((v) => v.clave)).toEqual(["nombres", "sexo"]);
    expect(filtrarVariablesPorProceso(variables, bajoDemanda).map((v) => v.clave)).toEqual([
      "nombres",
      "sexo",
      "familiares",
    ]);
    expect(filtrarVariablesPorProceso(variables, undefined)).toHaveLength(3);
  });

  it("prepara un catálogo por proceso sin mutar el catálogo completo", () => {
    const catalogo = { ...CATALOGO, procesos: [ingreso, bajoDemanda], variables };
    const filtrado = catalogoParaProceso(catalogo, "ingreso");
    expect(filtrado?.variables.map((v) => v.clave)).toEqual(["nombres", "sexo"]);
    expect(catalogo.variables).toHaveLength(3);
    expect(catalogoParaProceso(catalogo, "inexistente")?.variables).toEqual([]);
  });

  it("rechaza variables y colecciones incompatibles con rutas concretas", () => {
    const definicion = formulario([
      { id: "b1", tipo: "parrafo", texto: "Trabajador: {nombres}", alineacion: "izquierda" },
      { id: "b2", tipo: "fila_campos", alto_mm: 10, celdas: [{ etiqueta: "Sexo", variable: "sexo", ancho: 6 }] },
      { id: "b3", tipo: "parrafo", texto: "Campo: {propio.cargo}", alineacion: "izquierda" },
      {
        id: "b4",
        tipo: "tabla",
        titulo: "Familiares",
        coleccion: "familiares",
        filas_minimas: 0,
        columnas: [{ variable: "nombre", etiqueta: "Nombre", ancho: 6 }],
      },
    ]);
    const errores = validarVariablesParaProceso(definicion, variables, ingreso, propios);
    expect(errores).toHaveLength(1);
    expect(errores[0].ruta).toBe("bloques.3.coleccion");
    expect(errores[0].mensaje).toContain("no está disponible para el proceso «Ingreso»");
  });

  it("también valida textos, condiciones y tablas del modo PDF overlay", () => {
    const definicion: DefinicionOverlay = {
      paginas: [
        {
          origen: 1,
          campos: [
            { id: "c1", tipo: "texto", x: 0, y: 0, w: 10, h: 5, texto: "{familiares}", tamano: 9, alineacion: "izquierda", negrita: false },
            { id: "c2", tipo: "casilla", x: 0, y: 10, w: 4, h: 4, condicion: { variable: "sexo", operador: "igual", valor: "FEMENINO" } },
            {
              id: "c3",
              tipo: "tabla",
              x: 0,
              y: 20,
              w: 100,
              h: 30,
              coleccion: "familiares",
              columnas: [{ variable: "nombre", dx: 0, ancho: 50, alineacion: "izquierda" }],
              interlineado: 5,
              filas_max: 5,
              tamano: 8,
            },
          ],
        },
      ],
    };
    expect(validarVariablesParaProceso(definicion, variables, ingreso, propios).map((e) => e.ruta)).toEqual([
      "paginas.0.campos.0.texto",
      "paginas.0.campos.2.coleccion",
    ]);
  });
});
