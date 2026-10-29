import { describe, expect, it } from "vitest";
import {
  cambiosAItems,
  diferencias,
  itemsARegistros,
  registrosAItems,
  reemplazarRegistrosDeEntidad,
} from "./borrador";
import { cambioFake } from "./fixtures-solicitud";

describe("borrador", () => {
  it("excluye la foto del borrador (el servidor la rechaza ahí)", () => {
    const items = cambiosAItems([
      cambioFake(),
      cambioFake({ id: "f", seccion: "foto", campo: "profile" }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      seccion: "contacto",
      entidad: "employee",
      campo: "telefono_movil",
      valor: "0414-1111111",
    });
  });

  it("agrupa MODIFICAR por registro y mantiene cada CREAR aparte; ida y vuelta", () => {
    const items = [
      {
        seccion: "familiar",
        entidad: "familiar",
        accion: "MODIFICAR" as const,
        campo: "primer_nombre",
        valor: "Ana",
        entidadId: "7",
      },
      {
        seccion: "familiar",
        entidad: "familiar",
        accion: "MODIFICAR" as const,
        campo: "primer_apellido",
        valor: "Paz",
        entidadId: "7",
      },
      {
        seccion: "familiar",
        entidad: "familiar",
        accion: "CREAR" as const,
        campo: "*",
        valor: { primer_nombre: "Luis" },
      },
    ];
    const registros = itemsARegistros(items);
    expect(registros).toHaveLength(2);
    expect(registros[0].valores).toEqual({ primer_nombre: "Ana", primer_apellido: "Paz" });
    expect(registrosAItems(registros)).toHaveLength(3);
    expect(registrosAItems(registros).find((i) => i.accion === "CREAR")?.campo).toBe("*");
  });

  it("diferencias ignora vacíos equivalentes y solo devuelve lo cambiado", () => {
    expect(diferencias({ a: "x", b: null, c: 3 }, { a: "x", b: "", c: 4 })).toEqual({ c: 4 });
    expect(diferencias({ a: null }, { a: " hola " })).toEqual({ a: "hola" });
  });

  it("reemplaza solo los registros de la entidad indicada", () => {
    const items = [
      {
        seccion: "contacto",
        entidad: "employee",
        accion: "MODIFICAR" as const,
        campo: "telefono_movil",
        valor: "1",
        entidadId: null,
      },
      {
        seccion: "contacto",
        entidad: "datos_complementarios",
        accion: "MODIFICAR" as const,
        campo: "correo_alternativo",
        valor: "a@b.co",
        entidadId: null,
      },
    ];
    const resultado = reemplazarRegistrosDeEntidad(items, "contacto", "employee", []);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].entidad).toBe("datos_complementarios");
  });
});
