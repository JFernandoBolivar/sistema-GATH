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

describe("menú por permiso + condición del trabajador", () => {
  const MENU_AUTOGESTION = [
    { title: "Mi expediente", permiso: "autogestion.ver_propio" },
    { title: "Fe de vida", permiso: "fe_de_vida.solicitar", condicion: "PASIVO" as const },
    { title: "Censo", permiso: "autogestion.censo_ver_propio", condicion: "ACTIVO" as const },
    { title: "Carnet", permiso: "carnetizacion.reimprimir", condicion: "ACTIVO" as const },
  ];
  const PERMISOS = [
    "autogestion.ver_propio",
    "autogestion.censo_ver_propio",
    "carnetizacion.reimprimir",
    "fe_de_vida.solicitar",
  ];
  const titulos = (c?: string | null) =>
    filtrarMenuPorPermisos(MENU_AUTOGESTION, PERMISOS, c).map((i) => i.title);

  it("pasivo ve fe de vida y no lo exclusivo de activos", () => {
    expect(titulos("PASIVO")).toEqual(["Mi expediente", "Fe de vida"]);
  });
  it("activo ve censo y carnet y no fe de vida", () => {
    expect(titulos("ACTIVO")).toEqual(["Mi expediente", "Censo", "Carnet"]);
  });
  it("condición desconocida o ausente oculta las entradas condicionadas (fail-closed)", () => {
    expect(titulos("SIN_ASIGNACION")).toEqual(["Mi expediente"]);
    expect(titulos(undefined)).toEqual(["Mi expediente"]);
  });
  it("tener la condición sin el permiso no basta", () => {
    expect(puedeVerItemMenu([], "fe_de_vida.solicitar", "PASIVO", "PASIVO")).toBe(false);
  });
});
