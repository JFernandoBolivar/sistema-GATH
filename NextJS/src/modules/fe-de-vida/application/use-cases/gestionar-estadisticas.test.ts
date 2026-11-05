import { describe, expect, it } from "vitest";
import { parametrosExportacion, obtenerEstadisticas, listarPasivosEstadistica } from "./gestionar-estadisticas";
import type { RepoFeDeVida } from "../../domain/ports/repo-fe-de-vida";

const estadisticas = {
  proceso: null,
  procesos: [],
  tipos: [],
  kpis: {
    total: 0, respondieron: 0, faltan: 0, validadas: 0,
    porcentajeRespondieron: 0, porcentajeFaltan: 0, porcentajeValidadas: 0,
  },
  porTipo: [], porEstado: [], porCanal: [], matriz: [],
  filtros: { procesoId: null, tipoNominaId: null, estado: null, canal: null, desde: null, hasta: null },
};

function repoFalso(): RepoFeDeVida {
  const espia = {
    filtros: null as unknown,
    listado: null as unknown,
  };
  const repo = {
    obtenerEstadisticas: async (f: unknown) => { espia.filtros = f; return estadisticas; },
    listarPasivosEstadistica: async (f: unknown) => {
      espia.listado = f;
      return { count: 0, limit: 10, offset: 0, results: [] };
    },
    // El resto del puerto no se usa en estas pruebas.
    __espia: espia,
  } as unknown as RepoFeDeVida & { __espia: typeof espia };
  return repo;
}

describe("casos de uso de estadísticas", () => {
  it("normaliza los filtros vacíos y el tipo de nómina a números", async () => {
    const repo = repoFalso() as RepoFeDeVida & { __espia: { filtros: Record<string, unknown> } };
    await obtenerEstadisticas(repo, {
      procesoId: "  ", tipoNominaId: 4, estado: "VALIDADA", canal: "PRESENCIAL",
      desde: "2026-01-01", hasta: "",
    });
    expect(repo.__espia.filtros).toMatchObject({
      limit: 10, offset: 0, tipoNominaId: 4, estado: "VALIDADA", canal: "PRESENCIAL",
      desde: "2026-01-01",
    });
    expect(repo.__espia.filtros.procesoId).toBeUndefined();
    expect(repo.__espia.filtros.hasta).toBeUndefined();
  });

  it("pide el detalle marcando faltantes o la casilla", async () => {
    const repo = repoFalso() as RepoFeDeVida & { __espia: { listado: Record<string, unknown> } };
    await listarPasivosEstadistica(repo, { faltantes: true, limit: 50, offset: 10 });
    expect(repo.__espia.listado).toMatchObject({ faltantes: true, limit: 50, offset: 10 });
    await listarPasivosEstadistica(repo, { tipoNominaId: 2, estado: "DEVUELTA" });
    expect(repo.__espia.listado).toMatchObject({ tipoNominaId: 2, estado: "DEVUELTA" });
    expect(repo.__espia.listado.faltantes).toBeUndefined();
  });

  it("arma los parámetros de exportación para faltantes y para una casilla", () => {
    expect(parametrosExportacion(
      { procesoId: "abc", tipoNominaId: 3, estado: "VALIDADA", canal: "EN_LINEA", desde: "2026-10-01", hasta: "" },
      "celda",
    )).toEqual({
      proceso_id: "abc", tipo_nomina_id: 3, estado: "VALIDADA", canal: "EN_LINEA",
      desde: "2026-10-01", hasta: undefined, listado: "celda",
    });

    expect(parametrosExportacion(
      { procesoId: "abc" },
      {
        formato: "pdf",
        incluirResumen: true,
        incluirGraficos: false,
        incluirListado: true,
        alcanceListado: "respondieron",
      },
    )).toEqual({
      proceso_id: "abc",
      tipo_nomina_id: undefined,
      estado: undefined,
      canal: undefined,
      desde: undefined,
      hasta: undefined,
      formato: "pdf",
      incluir_resumen: true,
      incluir_graficos: false,
      incluir_listado: true,
      alcance_listado: "respondieron",
    });
  });
});
