import { describe, expect, it } from "vitest";
import { catalogoFiltroSchema } from "./schema-catalogos";

describe("Schema de Filtro de Catálogos", () => {
  it("valida un código de catálogo válido", () => {
    const valid = catalogoFiltroSchema.safeParse({ codigo: "sexos" });
    expect(valid.success).toBe(true);
  });

  it("valida todos los códigos de catálogo soportados", () => {
    const codigos = [
      "regiones",
      "estados",
      "municipios",
      "parroquias",
      "sexos",
      "estatus",
      "tipos-personal",
      "tipos-nomina",
      "parentescos",
      "tipos-procedencia",
      "grados",
      "categorias-movimiento",
      "tipos-movimiento",
    ];
    for (const codigo of codigos) {
      const result = catalogoFiltroSchema.safeParse({ codigo });
      expect(result.success).toBe(true);
    }
  });

  it("rechaza un código no incluido", () => {
    const invalid = catalogoFiltroSchema.safeParse({ codigo: "gatos" });
    expect(invalid.success).toBe(false);
  });

  it("rechaza campos faltantes", () => {
    const invalid = catalogoFiltroSchema.safeParse({});
    expect(invalid.success).toBe(false);
  });
});
