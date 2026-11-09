import { describe, expect, it, vi } from "vitest";

vi.mock("../infrastructure/actions/registro-actions", () => ({ resolverAltasInlineAction: vi.fn() }));

import { resolverPendientesOtra, type PendienteOtra } from "./resolver-otra";

const pendiente = (nombre: string, destino: { id?: number }): PendienteOtra => ({
  solicitud: { tipo: "instituciones", nombre },
  faltaNombre: "Debe escribir el nombre de la nueva institución",
  asignar: (id) => {
    destino.id = id;
  },
});

describe("resolverPendientesOtra", () => {
  it("no llama al servidor si no hay pendientes", async () => {
    const resolver = vi.fn();
    expect(await resolverPendientesOtra([], resolver)).toBeNull();
    expect(resolver).not.toHaveBeenCalled();
  });

  it("exige el nombre antes de llamar al servidor", async () => {
    const resolver = vi.fn();
    expect(await resolverPendientesOtra([pendiente("  ", {})], resolver)).toBe("Debe escribir el nombre de la nueva institución");
    expect(resolver).not.toHaveBeenCalled();
  });

  it("asigna los ids devueltos en orden", async () => {
    const a: { id?: number } = {};
    const b: { id?: number } = {};
    const resolver = vi.fn().mockResolvedValue({ ok: [{ id: 7, nombre: "A" }, { id: 8, nombre: "B" }] });
    expect(await resolverPendientesOtra([pendiente("A", a), pendiente("B", b)], resolver)).toBeNull();
    expect([a.id, b.id]).toEqual([7, 8]);
  });

  it("propaga el error del servidor", async () => {
    const resolver = vi.fn().mockResolvedValue({ error: "Sin permiso" });
    expect(await resolverPendientesOtra([pendiente("A", {})], resolver)).toBe("Sin permiso");
  });
});
