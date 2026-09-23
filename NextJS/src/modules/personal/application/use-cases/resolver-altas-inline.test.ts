import { describe, expect, it } from "vitest";

import type { RepoCatalogosAltaInline, TipoCatalogoInline } from "../../domain/ports/catalogos-alta-inline";
import { resolverAltasInline } from "./resolver-altas-inline";

function repoEnMemoria() {
  const datos: Record<string, { id: number; nombre: string }[]> = {
    "carreras|3": [{ id: 10, nombre: "Ingeniería Electrónica" }],
    "menciones|10": [{ id: 20, nombre: "Telecomunicaciones" }],
    "instituciones|": [{ id: 30, nombre: "UCV" }],
    "capacitaciones|": [],
  };
  const creados: { tipo: TipoCatalogoInline; nombre: string; padreId: number | null }[] = [];
  let listados = 0;
  let siguiente = 100;
  const repo: RepoCatalogosAltaInline = {
    async listar(tipo, padreId) {
      listados += 1;
      return datos[`${tipo}|${padreId ?? ""}`] ?? [];
    },
    async crear(tipo, nombre, padreId) {
      creados.push({ tipo, nombre, padreId });
      const nuevo = { id: siguiente++, nombre };
      (datos[`${tipo}|${padreId ?? ""}`] ??= []).push(nuevo);
      return nuevo;
    },
  };
  return { repo, creados, listados: () => listados };
}

describe("resolverAltasInline", () => {
  it("crea lo que no existe y devuelve en el mismo orden", async () => {
    const { repo, creados } = repoEnMemoria();
    const r = await resolverAltasInline(repo, [
      { tipo: "carreras", nombre: "  Medicina ", padreId: 3 },
      { tipo: "capacitaciones", nombre: "Oratoria" },
    ]);
    expect(r).toEqual([
      { id: 100, nombre: "Medicina" },
      { id: 101, nombre: "Oratoria" },
    ]);
    expect(creados).toEqual([
      { tipo: "carreras", nombre: "Medicina", padreId: 3 },
      { tipo: "capacitaciones", nombre: "Oratoria", padreId: null },
    ]);
  });

  it("reutiliza el existente sin distinguir mayúsculas, acentos ni espacios", async () => {
    const { repo, creados } = repoEnMemoria();
    const r = await resolverAltasInline(repo, [
      { tipo: "carreras", nombre: "ingenieria   ELECTRONICA", padreId: 3 },
      { tipo: "instituciones", nombre: "ucv" },
      { tipo: "menciones", nombre: "telecomunicaciones", padreId: 10 },
    ]);
    expect(r.map((x) => x.id)).toEqual([10, 30, 20]);
    expect(creados).toHaveLength(0);
  });

  it("resuelve una sola vez las solicitudes repetidas y lista una vez por padre", async () => {
    const { repo, creados, listados } = repoEnMemoria();
    const r = await resolverAltasInline(repo, [
      { tipo: "instituciones", nombre: "UNEXPO" },
      { tipo: "instituciones", nombre: "unexpo" },
    ]);
    expect(r[0]).toEqual(r[1]);
    expect(creados).toHaveLength(1);
    expect(listados()).toBe(1);
  });

  it("exige padre para carreras y menciones, y nombre no vacío", async () => {
    const { repo } = repoEnMemoria();
    await expect(resolverAltasInline(repo, [{ tipo: "carreras", nombre: "X" }])).rejects.toThrow(/nivel académico/);
    await expect(resolverAltasInline(repo, [{ tipo: "menciones", nombre: "X", padreId: 0 }])).rejects.toThrow(/carrera/);
    await expect(resolverAltasInline(repo, [{ tipo: "instituciones", nombre: "   " }])).rejects.toThrow(/vacío/);
  });

  it("ignora el padre en instituciones y capacitaciones", async () => {
    const { repo, creados } = repoEnMemoria();
    await resolverAltasInline(repo, [{ tipo: "capacitaciones", nombre: "Excel", padreId: 7 }]);
    expect(creados[0].padreId).toBeNull();
  });
});
