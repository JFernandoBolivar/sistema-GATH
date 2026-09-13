import { describe, expect, it, vi } from "vitest";

import type { RepoPasivos } from "../../domain/ports/repo-pasivos";
import type { CatalogosExpedientePasivo } from "../../domain/ports/catalogos-expediente";
import { listarCatalogosExpedientePasivo } from "./listar-catalogos-expediente";

function fakeCatalogos(): CatalogosExpedientePasivo {
  return {
    estados: [{ id: 1, nombre: "Distrito Capital" }],
    municipios: [],
    parroquias: [],
    condicionesVivienda: [],
    codigosPostales: [],
    gruposSanguineos: [{ id: 2, nombre: "O+" }],
    alergias: [],
    patologias: [],
    discapacidades: [],
    tallas: [{ id: 3, nombre: "M" }],
    nivelesAcademicos: [],
    carreras: [],
    menciones: [],
    instituciones: [],
    politicas: [],
  };
}

function fakeRepo(overrides: Partial<RepoPasivos> = {}): RepoPasivos {
  return {
    listarPasivos: vi.fn(),
    obtenerPorCedula: vi.fn(),
    procesarEgreso: vi.fn(),
    listarMotivosEgreso: vi.fn(),
    listarTiposNomina: vi.fn(),
    listarCatalogosExpediente: vi.fn().mockResolvedValue(fakeCatalogos()),
    ...overrides,
  };
}

describe("listarCatalogosExpedientePasivo", () => {
  it("delega en repo.listarCatalogosExpediente y devuelve el DTO tal cual", async () => {
    const repo = fakeRepo();

    const dto = await listarCatalogosExpedientePasivo(repo);

    expect(repo.listarCatalogosExpediente).toHaveBeenCalledTimes(1);
    expect(dto.estados).toEqual([{ id: 1, nombre: "Distrito Capital" }]);
    expect(dto.gruposSanguineos).toEqual([{ id: 2, nombre: "O+" }]);
    expect(dto.tallas).toEqual([{ id: 3, nombre: "M" }]);
  });

  it("propaga el error del repositorio si falla la carga de catálogos", async () => {
    const repo = fakeRepo({
      listarCatalogosExpediente: vi.fn().mockRejectedValue(new Error("catálogos no disponibles")),
    });

    await expect(listarCatalogosExpedientePasivo(repo)).rejects.toThrow("catálogos no disponibles");
  });
});
