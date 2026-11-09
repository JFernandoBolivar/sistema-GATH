import { describe, expect, it } from "vitest";
import {
  dependenciaSchema,
  hierarchyDependencySchema,
  organismoAdscritoSchema,
} from "./schema-organizacion";

describe("Longitudes de los formularios de organización", () => {
  it("dependencia: código 1-20 y nombre 2-200", () => {
    expect(dependenciaSchema.safeParse({ codigo: "01", nombre: "Nivel" }).success).toBe(true);
    expect(dependenciaSchema.safeParse({ codigo: "", nombre: "Nivel" }).success).toBe(false);
    expect(dependenciaSchema.safeParse({ codigo: "1".repeat(21), nombre: "Nivel" }).success).toBe(false);
    expect(dependenciaSchema.safeParse({ codigo: "01", nombre: "A" }).success).toBe(false);
    expect(dependenciaSchema.safeParse({ codigo: "01", nombre: "A".repeat(201) }).success).toBe(false);
  });

  it("organismo adscrito: nombre 2-50", () => {
    expect(organismoAdscritoSchema.safeParse({ nombre: "X".repeat(51) }).success).toBe(false);
    expect(organismoAdscritoSchema.safeParse({ nombre: "X" }).success).toBe(false);
    expect(organismoAdscritoSchema.safeParse({ nombre: "Organismo" }).success).toBe(true);
  });

  it("jerarquía: limita código y nombre de los niveles opcionales", () => {
    const base = { dependency: { codigo: "01", nombre: "Nivel" }, activeDirectionGeneral: true };
    const r = hierarchyDependencySchema.safeParse({
      ...base,
      direction_general: { codigo: "1".repeat(21), nombre: "Oficina" },
    });
    expect(r.success).toBe(false);
  });
});
