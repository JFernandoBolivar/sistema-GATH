import { describe, expect, it, vi } from "vitest";
import type { RepoCatalogos } from "../../domain/ports/repo-catalogos";
import {
  crearAlergia,
  crearCategoriaAlergia,
  crearCategoriaDiscapacidad,
  crearCategoriaPatologia,
  crearDiscapacidad,
  crearPatologia,
  crearRegionTalla,
  crearTalla,
  crearTipoPrenda,
  eliminarAlergia,
  eliminarCategoriaAlergia,
  eliminarDiscapacidad,
  eliminarPatologia,
  eliminarRegionTalla,
  eliminarTalla,
  eliminarTipoPrenda,
  listarCategoriasAlergia,
  listarCategoriasDiscapacidad,
  listarCategoriasPatologia,
} from "./gestionar-catalogos";

function crearRepoMock(): RepoCatalogos {
  return {
    listarRegiones: vi.fn(),
    listarEstados: vi.fn(),
    listarMunicipios: vi.fn(),
    listarParroquias: vi.fn(),
    listarSexos: vi.fn(),
    listarEstatus: vi.fn(),
    listarTiposPersonal: vi.fn(),
    listarTiposNomina: vi.fn(),
    listarParentescos: vi.fn(),
    listarTiposProcedencia: vi.fn(),
    listarGrados: vi.fn(),
    listarCategoriasMovimiento: vi.fn(),
    listarTiposMovimiento: vi.fn(),
    listarEstadosCiviles: vi.fn(),
    listarPoliticas: vi.fn(),
    listarCondicionesVivienda: vi.fn(),
    listarCodigosPostales: vi.fn(),
    listarGruposSanguineos: vi.fn(),
    listarNivelesAcademicos: vi.fn(),
    listarCarreras: vi.fn(),
    listarMenciones: vi.fn(),
    listarInstituciones: vi.fn(),
    listarTiposPrenda: vi.fn(),
    listarRegionesTalla: vi.fn(),
    listarTallas: vi.fn(),
    listarCapacitaciones: vi.fn(),
    listarGruposCapacitacion: vi.fn(),
    listarAlergias: vi.fn(),
    listarPatologias: vi.fn(),
    listarDiscapacidades: vi.fn(),

    crearAlergia: vi.fn().mockResolvedValue({ id: 1, nombre: "Penicilina" }),
    eliminarAlergia: vi.fn().mockResolvedValue(undefined),
    listarCategoriasAlergia: vi.fn().mockResolvedValue([{ id: 1, nombre: "Medicamentos" }]),
    crearCategoriaAlergia: vi.fn().mockResolvedValue({ id: 2, nombre: "Alimentos" }),
    eliminarCategoriaAlergia: vi.fn().mockResolvedValue(undefined),

    crearPatologia: vi.fn().mockResolvedValue({ id: 1, nombre: "Asma" }),
    eliminarPatologia: vi.fn().mockResolvedValue(undefined),
    listarCategoriasPatologia: vi.fn().mockResolvedValue([{ id: 1, nombre: "Respiratorias" }]),
    crearCategoriaPatologia: vi.fn().mockResolvedValue({ id: 2, nombre: "Cardiovasculares" }),
    eliminarCategoriaPatologia: vi.fn().mockResolvedValue(undefined),

    crearDiscapacidad: vi.fn().mockResolvedValue({ id: 1, nombre: "Visual" }),
    eliminarDiscapacidad: vi.fn().mockResolvedValue(undefined),
    listarCategoriasDiscapacidad: vi.fn().mockResolvedValue([{ id: 1, nombre: "Sensorial" }]),
    crearCategoriaDiscapacidad: vi.fn().mockResolvedValue({ id: 2, nombre: "Motriz" }),
    eliminarCategoriaDiscapacidad: vi.fn().mockResolvedValue(undefined),

    crearTalla: vi.fn().mockResolvedValue({ id: 1, nombre: "M" }),
    eliminarTalla: vi.fn().mockResolvedValue(undefined),

    crearRegionTalla: vi.fn().mockResolvedValue({ id: 1, nombre: "ADULTO" }),
    eliminarRegionTalla: vi.fn().mockResolvedValue(undefined),

    crearTipoPrenda: vi.fn().mockResolvedValue({ id: 1, nombre: "Camisa" }),
    eliminarTipoPrenda: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Casos de uso de gestión de catálogos", () => {
  it("crearAlergia y eliminarAlergia", async () => {
    const repo = crearRepoMock();
    const res = await crearAlergia(repo, { alergia: "  Penicilina  ", categoria_id: 1 });
    expect(res).toEqual({ id: 1, nombre: "Penicilina" });
    expect(repo.crearAlergia).toHaveBeenCalledWith({ alergia: "Penicilina", categoria_id: 1 });

    await eliminarAlergia(repo, 1);
    expect(repo.eliminarAlergia).toHaveBeenCalledWith(1);
  });

  it("categorías de alergia CRUD", async () => {
    const repo = crearRepoMock();
    const cats = await listarCategoriasAlergia(repo);
    expect(cats).toHaveLength(1);

    const nueva = await crearCategoriaAlergia(repo, { nombre_categoria: "Alimentos" });
    expect(nueva.nombre).toBe("Alimentos");

    await eliminarCategoriaAlergia(repo, 2);
    expect(repo.eliminarCategoriaAlergia).toHaveBeenCalledWith(2);
  });

  it("patologías y discapacidades CRUD", async () => {
    const repo = crearRepoMock();
    const p = await crearPatologia(repo, { patologia: "Asma", categoria_id: 1 });
    expect(p.nombre).toBe("Asma");
    await eliminarPatologia(repo, 1);
    expect(repo.eliminarPatologia).toHaveBeenCalledWith(1);

    const d = await crearDiscapacidad(repo, { discapacidad: "Visual", categoria_id: 1 });
    expect(d.nombre).toBe("Visual");
    await eliminarDiscapacidad(repo, 1);
    expect(repo.eliminarDiscapacidad).toHaveBeenCalledWith(1);

    expect(await listarCategoriasPatologia(repo)).toHaveLength(1);
    expect(await listarCategoriasDiscapacidad(repo)).toHaveLength(1);
    await crearCategoriaPatologia(repo, { nombre_categoria: "Cardio" });
    await crearCategoriaDiscapacidad(repo, { nombre_categoria: "Física" });
  });

  it("tallas, regiones de talla y tipos de prenda CRUD", async () => {
    const repo = crearRepoMock();
    const talla = await crearTalla(repo, { valor: "M", region_id: 1, tipo_prenda_id: 1 });
    expect(talla.nombre).toBe("M");
    await eliminarTalla(repo, 1);
    expect(repo.eliminarTalla).toHaveBeenCalledWith(1);

    const region = await crearRegionTalla(repo, { codigo: "ADULTO", descripcion: "Para adultos" });
    expect(region.nombre).toBe("ADULTO");
    await eliminarRegionTalla(repo, 1);
    expect(repo.eliminarRegionTalla).toHaveBeenCalledWith(1);

    const tipo = await crearTipoPrenda(repo, { categoria: "Camisa" });
    expect(tipo.nombre).toBe("Camisa");
    await eliminarTipoPrenda(repo, 1);
    expect(repo.eliminarTipoPrenda).toHaveBeenCalledWith(1);
  });
});
