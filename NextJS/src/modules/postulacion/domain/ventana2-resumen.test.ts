import { describe, expect, it } from "vitest";
import { CATALOGOS_VACIOS } from "./ventana2";
import { resumirVentana2 } from "./ventana2-resumen";

describe("resumen legible de la Ventana 2", () => {
  const c = {
    ...CATALOGOS_VACIOS,
    parentescos: [{ id: 1, nombre: "Hijo(a)", esHijo: true, menorACargo: false, sinCedulaHastaEdad: 9, permiteOrdenHijo: true }],
    alergias: [{ id: 5, nombre: "Polen" }],
    gruposSanguineos: [{ id: 2, nombre: "O+" }],
  };
  it("sustituye ids por nombres y describe al familiar", () => {
    const r = resumirVentana2(
      { familiares: [{ primer_nombre: "Ana", primer_apellido: "Pérez", parentesco_id: 1, fecha_nacimiento: "2021-01-01", orden_hijo: 1, depende_economicamente: true }], salud: { grupo_sanguineo_id: 2, alergias: [5] } },
      c,
      new Date("2026-11-24T12:00:00Z"),
    );
    expect(r.familiares[0]).toEqual({ titulo: "Ana Pérez", detalle: "Hijo(a) · 5 años · sin cédula, hijo N.º 1 · depende de ti" });
    expect(r.salud).toContainEqual({ etiqueta: "Grupo sanguíneo", valor: "O+" });
    expect(r.salud).toContainEqual({ etiqueta: "Alergias", valor: "Polen" });
    expect(r.salud).toContainEqual({ etiqueta: "Discapacidades", valor: "Ninguna" });
  });
});
