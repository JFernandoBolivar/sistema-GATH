import { describe, expect, it } from "vitest";

import { filtrarMenuPorPermisos, puedeVerItemMenu } from "./permiso-menu";

const MENU = [
  { title: "Inicio" },
  {
    title: "Cargos",
    subMenu: [
      { title: "Crear", permiso: "cargos.crear" },
      { title: "Ver", permiso: "cargos.ver" },
    ],
  },
  { title: "Retro", permiso: "configuracion.editar" },
];

describe("menú por permisos", () => {
  it("ítem sin permiso es visible para todos", () => {
    expect(puedeVerItemMenu([], undefined)).toBe(true);
  });
  it("presupuesto ve cargos.ver pero no cargos.crear", () => {
    const r = filtrarMenuPorPermisos(MENU, ["cargos.ver"]);
    expect(r.map((i) => i.title)).toEqual(["Inicio", "Cargos"]);
    expect(r[1].subMenu?.map((s) => s.title)).toEqual(["Ver"]);
  });
  it("grupo sin hijos visibles se oculta", () => {
    expect(filtrarMenuPorPermisos(MENU, []).map((i) => i.title)).toEqual(["Inicio"]);
  });
  it("administrador (*) ve todo", () => {
    expect(filtrarMenuPorPermisos(MENU, ["*"])).toHaveLength(3);
  });
});
