import { describe, expect, it } from "vitest";
import { ITEMS_NAV_AUTOGESTION, itemActivo, itemsVisibles } from "./nav-autogestion";

const ids = (permisos: string[], condicion: string | null) =>
  itemsVisibles(permisos, condicion).map((i) => i.id);

describe("itemsVisibles", () => {
  it("el trabajador activo ve ficha, solicitudes y censo por permiso + condición", () => {
    const permisos = [
      "autogestion.ver_propio",
      "autogestion.solicitar_actualizacion",
      "autogestion.censo_ver_propio",
    ];
    expect(ids(permisos, "ACTIVO")).toEqual([
      "inicio",
      "ficha",
      "solicitar",
      "solicitudes",
      "censo",
    ]);
  });
  it("sin condición ACTIVO (pasivo o sin asignación) se ocultan las entradas de activos", () => {
    const permisos = [
      "autogestion.ver_propio",
      "autogestion.solicitar_actualizacion",
      "autogestion.censo_ver_propio",
    ];
    expect(ids(permisos, "PASIVO")).toEqual(["inicio", "ficha"]);
    expect(ids(permisos, "SIN_ASIGNACION")).toEqual(["inicio", "ficha"]);
    expect(ids(permisos, null)).toEqual(["inicio", "ficha"]);
  });
  it("sin permisos solo queda Inicio y no se usa el nombre del rol", () => {
    expect(ids([], "ACTIVO")).toEqual(["inicio"]);
  });
  it("las entradas administrativas dependen de su permiso", () => {
    expect(ids(["autogestion.censo_ver_todos"], null)).toEqual(["inicio", "encuesta", "metricas"]);
  });
  it("el comodín del módulo concede todo lo permitido por condición", () => {
    expect(ids(["autogestion.*"], "ACTIVO")).toHaveLength(ITEMS_NAV_AUTOGESTION.length);
  });
});

describe("itemActivo", () => {
  const por = (id: string) => ITEMS_NAV_AUTOGESTION.find((i) => i.id === id)!;
  it("Inicio solo coincide exacto", () => {
    expect(itemActivo(por("inicio"), "/autogestion")).toBe(true);
    expect(itemActivo(por("inicio"), "/autogestion/ficha")).toBe(false);
  });
  it("Mis solicitudes incluye el detalle pero no «nueva»", () => {
    expect(itemActivo(por("solicitudes"), "/autogestion/solicitudes")).toBe(true);
    expect(itemActivo(por("solicitudes"), "/autogestion/solicitudes/abc")).toBe(true);
    expect(itemActivo(por("solicitudes"), "/autogestion/solicitudes/nueva")).toBe(false);
    expect(itemActivo(por("solicitar"), "/autogestion/solicitudes/nueva")).toBe(true);
  });
});
