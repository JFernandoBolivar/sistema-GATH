import { describe, expect, it } from "vitest";
import {
  catalogoFiltroSchema,
  crearAlergiaSchema,
  crearCategoriaSchema,
  crearPatologiaSchema,
  crearRegionTallaSchema,
  crearTallaSchema,
  eliminarItemSchema,
} from "./schema-catalogos";

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

describe("Schemas de CRUD de Catálogos de Soporte", () => {
  it("valida crearCategoriaSchema", () => {
    expect(crearCategoriaSchema.safeParse({ nombre_categoria: "Alimentos" }).success).toBe(true);
    expect(crearCategoriaSchema.safeParse({ nombre_categoria: "" }).success).toBe(false);
  });

  it("valida crearAlergiaSchema y crearPatologiaSchema", () => {
    expect(crearAlergiaSchema.safeParse({ alergia: "Penicilina", categoria_id: 1 }).success).toBe(true);
    expect(crearAlergiaSchema.safeParse({ alergia: "", categoria_id: 1 }).success).toBe(false);
    expect(crearAlergiaSchema.safeParse({ alergia: "Penicilina", categoria_id: 0 }).success).toBe(false);

    expect(crearPatologiaSchema.safeParse({ patologia: "Asma", categoria_id: 2 }).success).toBe(true);
    expect(crearPatologiaSchema.safeParse({ patologia: "", categoria_id: 2 }).success).toBe(false);
  });

  it("valida crearTallaSchema y crearRegionTallaSchema", () => {
    expect(crearTallaSchema.safeParse({ valor: "M", region_id: 1, tipo_prenda_id: 2 }).success).toBe(true);
    expect(crearTallaSchema.safeParse({ valor: "", region_id: 1, tipo_prenda_id: 2 }).success).toBe(false);

    expect(crearRegionTallaSchema.safeParse({ codigo: "ADULTO", descripcion: "Para adultos" }).success).toBe(true);
    expect(crearRegionTallaSchema.safeParse({ codigo: "CODIGO_DEMASIADO_LARGO" }).success).toBe(false);
  });

  it("valida eliminarItemSchema", () => {
    expect(eliminarItemSchema.safeParse({ id: 5 }).success).toBe(true);
    expect(eliminarItemSchema.safeParse({ id: -1 }).success).toBe(false);
  });
});

