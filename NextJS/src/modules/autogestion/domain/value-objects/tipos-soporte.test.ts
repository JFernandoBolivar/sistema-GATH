import { describe, expect, it } from "vitest";

import { agruparTiposSoporte, tiposDeSeccion } from "./tipos-soporte";

describe("tipos de soporte configurables", () => {
  it("agrupa por sección y conserva el orden del backend", () => {
    const config = agruparTiposSoporte([
      { seccion: "formacion", codigo: "CONSTANCIA", nombre: "Constancia", requerido: true, orden: 20 },
      { seccion: "familiar", codigo: "CEDULA", nombre: "Cédula", requerido: true, orden: 10 },
      { seccion: "formacion", codigo: "TITULO", nombre: "Título", requerido: true, orden: 10 },
    ]);

    expect(tiposDeSeccion(config, "formacion").map((t) => t.codigo)).toEqual([
      "TITULO",
      "CONSTANCIA",
    ]);
    expect(tiposDeSeccion(config, "familiar").map((t) => t.codigo)).toEqual(["CEDULA"]);
  });

  it("una sección sin checklist devuelve una lista vacía", () => {
    expect(tiposDeSeccion({}, "salud")).toEqual([]);
    expect(tiposDeSeccion(undefined, "salud")).toEqual([]);
  });
});
