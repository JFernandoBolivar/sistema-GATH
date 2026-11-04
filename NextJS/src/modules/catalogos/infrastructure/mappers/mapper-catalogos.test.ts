import { describe, expect, it } from "vitest";
import { catalogoApiAEntidad } from "./mapper-catalogos";

describe("catalogoApiAEntidad", () => {
  it("usa nombre cuando el API lo trae", () => {
    expect(catalogoApiAEntidad({ id: 1, nombre: "BOMBEROS" })).toEqual({ id: 1, nombre: "BOMBEROS" });
  });

  it("no devuelve undefined si el API manda solo nombre_categoria (regresión «undefined» en Retroalimentación)", () => {
    const raw = { id: 3, nombre_categoria: "Alimentos" } as unknown as Parameters<typeof catalogoApiAEntidad>[0];
    expect(catalogoApiAEntidad(raw).nombre).toBe("Alimentos");
  });

  it("toma el texto de alergia, patologia o discapacidad en respuestas de escritura", () => {
    const alergia = { id: 4, alergia: "Maní" } as unknown as Parameters<typeof catalogoApiAEntidad>[0];
    const discapacidad = { id: 5, discapacidad: "Visual" } as unknown as Parameters<typeof catalogoApiAEntidad>[0];
    expect(catalogoApiAEntidad(alergia).nombre).toBe("Maní");
    expect(catalogoApiAEntidad(discapacidad).nombre).toBe("Visual");
  });

  it("cae a cadena vacía y nunca a undefined", () => {
    const raw = { id: 9 } as unknown as Parameters<typeof catalogoApiAEntidad>[0];
    expect(catalogoApiAEntidad(raw).nombre).toBe("");
  });
});
