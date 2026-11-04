import { describe, expect, it } from "vitest";
import { schemaAds } from "./schemaAds";
import { schemaCategory } from "./schemaCategory";
import { schemaRegionTalla } from "./schemaRegionTalla";
import { schemaPatologys } from "./schemaPatologys";

describe("schemas de retroalimentación: longitudes", () => {
  it("organismo: 2 a 50 caracteres", () => {
    expect(schemaAds.safeParse({ Organismoadscrito: "A" }).success).toBe(false);
    expect(schemaAds.safeParse({ Organismoadscrito: "CONATEL" }).success).toBe(true);
    expect(schemaAds.safeParse({ Organismoadscrito: "X".repeat(51) }).success).toBe(false);
  });

  it("categoría: 2 a 100 caracteres y recorta espacios", () => {
    expect(schemaCategory.safeParse({ nombre_categoria: " a " }).success).toBe(false);
    expect(schemaCategory.safeParse({ nombre_categoria: "X".repeat(101) }).success).toBe(false);
    expect(schemaCategory.parse({ nombre_categoria: "  Visual  " }).nombre_categoria).toBe("Visual");
  });

  it("región de talla: máximo 10", () => {
    expect(schemaRegionTalla.safeParse({ codigo: "X".repeat(11) }).success).toBe(false);
    expect(schemaRegionTalla.safeParse({ codigo: "US" }).success).toBe(true);
  });

  it("patología: mínimo 2", () => {
    expect(schemaPatologys.safeParse({ patologia: "a", categoria_id: 1 }).success).toBe(false);
    expect(schemaPatologys.safeParse({ patologia: "Asma", categoria_id: 1 }).success).toBe(true);
  });
});
