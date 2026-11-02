import { describe, expect, it } from "vitest";
import { tienePermiso } from "@/shared/lib/evaluador-iam";

describe("Organizacion PBAC Evaluation", () => {
  it("deniega acciones administrativas a usuario con rol de solo lectura (organizacion.ver)", () => {
    const permisos = ["organizacion.ver"];
    expect(tienePermiso(permisos, "organizacion.crear")).toBe(false);
    expect(tienePermiso(permisos, "organizacion.editar")).toBe(false);
    expect(tienePermiso(permisos, "organizacion.eliminar")).toBe(false);
  });

  it("concede crear unidad cuando tiene organizacion.crear", () => {
    const permisos = ["organizacion.ver", "organizacion.crear"];
    expect(tienePermiso(permisos, "organizacion.crear")).toBe(true);
    expect(tienePermiso(permisos, "organizacion.editar")).toBe(false);
    expect(tienePermiso(permisos, "organizacion.eliminar")).toBe(false);
  });

  it("concede permisos completos con wildcard del modulo organizacion.*", () => {
    const permisos = ["organizacion.*"];
    expect(tienePermiso(permisos, "organizacion.crear")).toBe(true);
    expect(tienePermiso(permisos, "organizacion.editar")).toBe(true);
    expect(tienePermiso(permisos, "organizacion.eliminar")).toBe(true);
  });
});
