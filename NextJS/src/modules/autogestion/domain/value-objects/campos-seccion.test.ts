import { describe, expect, it } from "vitest";
import {
  accionesPermitidas,
  claveAccion,
  etiquetaClaveCampo,
  pedidaPorAcciones,
  seccionDeCampo,
} from "./campos-seccion";

describe("acciones de las secciones de lista", () => {
  it("la clave de acción se agrupa en su sección y las inventadas no", () => {
    expect(seccionDeCampo(claveAccion("familiar", "CREAR"))).toBe("familiar");
    expect(seccionDeCampo(claveAccion("contacto_emergencia", "ELIMINAR"))).toBe("contacto");
    expect(seccionDeCampo(claveAccion("formacion_academica", "MODIFICAR"))).toBe("formacion");
    expect(seccionDeCampo("familiar.@BORRAR")).toBeUndefined();
    expect(seccionDeCampo("employee.@CREAR")).toBeUndefined();
  });

  it("Bienestar lee las acciones en lenguaje claro", () => {
    expect(etiquetaClaveCampo("familiar.@CREAR")).toBe("Quiere agregar un familiar");
    expect(etiquetaClaveCampo("familiar.@MODIFICAR")).toBe("Quiere corregir datos de un familiar");
    expect(etiquetaClaveCampo("contacto_emergencia.@ELIMINAR")).toBe(
      "Quiere quitar un contacto de emergencia",
    );
  });

  it("el borrador solo permite las acciones solicitadas", () => {
    expect(accionesPermitidas("familiar", ["familiar.@CREAR"])).toEqual(["CREAR"]);
    expect(accionesPermitidas("familiar", ["familiar.@CREAR", "familiar.@ELIMINAR"])).toEqual([
      "CREAR",
      "ELIMINAR",
    ]);
    expect(pedidaPorAcciones("familiar", ["familiar.@CREAR"])).toBe(true);
  });

  it("una solicitud vieja con campos sueltos permite todas las acciones; sin nada, ninguna", () => {
    expect(accionesPermitidas("familiar", ["familiar.primer_nombre"])).toEqual([
      "CREAR",
      "MODIFICAR",
      "ELIMINAR",
    ]);
    expect(pedidaPorAcciones("familiar", ["familiar.primer_nombre"])).toBe(false);
    expect(accionesPermitidas("familiar", ["employee.telefono_movil"])).toEqual([]);
  });
});
