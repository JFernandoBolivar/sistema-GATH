import { beforeEach, describe, expect, it, vi } from "vitest";

const pasivos = vi.hoisted(() => vi.fn());
const activos = vi.hoisted(() => vi.fn());

vi.mock("@/modules/pasivos/infrastructure/actions/pasivos-actions", () => ({
  getTiposNominaAction: pasivos,
}));
vi.mock("@/modules/cargos/infrastructure/actions/cargos-actions", () => ({
  getTiposNominaAction: activos,
}));
vi.mock("@/modules/catalogos/infrastructure/actions/catalogos-actions", () => ({}));
vi.mock("@/shared/infrastructure/actions/catalog-actions", () => ({}));
vi.mock("@/modules/reportes/infrastructure/actions/reportes-actions", () => ({}));

import { getNominaPorCategoria } from "./reportes-catalogos";

describe("getNominaPorCategoria", () => {
  beforeEach(() => {
    pasivos.mockReset().mockResolvedValue([{ id: 7, nombre: "JUBILADO" }]);
    activos.mockReset().mockResolvedValue([{ id: 1, nombre: "FUNCIONARIO" }]);
  });

  it("pasivos lista solo los tipos de pasivo (solo_pasivos = es_activo false)", async () => {
    const r = await getNominaPorCategoria("pasivos");
    expect(pasivos).toHaveBeenCalledWith(true);
    expect(activos).not.toHaveBeenCalled();
    expect(r.data.map((n) => n.nombre)).toEqual(["JUBILADO"]);
  });

  it("empleados lista solo las nóminas activas (solo_activos = es_activo true)", async () => {
    const r = await getNominaPorCategoria("empleados");
    expect(activos).toHaveBeenCalled();
    expect(pasivos).not.toHaveBeenCalled();
    expect(r.data.map((n) => n.nombre)).toEqual(["FUNCIONARIO"]);
  });
});
