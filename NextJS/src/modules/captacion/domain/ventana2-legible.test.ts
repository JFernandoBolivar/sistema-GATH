import { describe, expect, it } from "vitest";
import { ventana2Legible } from "./ventana2-legible";

describe("Ventana 2 legible para Captación", () => {
  it("sin datos es vacía", () => {
    expect(ventana2Legible(null).vacia).toBe(true);
  });
  it("dibuja familiares, vivienda, salud y tallas con nombres", () => {
    const v = ventana2Legible({
      sin_familiares: false,
      familiares: [{ primer_nombre: "Ana", primer_apellido: "Pérez", parentesco: { id: 1, nombre: "Hijo(a)" }, sexo: { id: 1, nombre: "Femenino" }, fecha_nacimiento: "2020-01-01", orden_hijo: 1, depende_economicamente: true }],
      vivienda: { direccion_exacta: "Calle 1", estado: { id: 1, nombre: "Miranda" }, municipio: { id: 2, nombre: "Sucre" }, parroquia: { id: 3, nombre: "Petare" }, condicion_vivienda: { id: 1, nombre: "Propia" } },
      salud: { grupo_sanguineo: { id: 1, nombre: "O+" }, alergias: [], patologias_cronicas: [{ id: 1, nombre: "Asma" }], discapacidades: [] },
      tallas: { camisa: { id: 1, valor: "M", region: "VE" }, pantalon: null, calzado: { id: 3, valor: "42", region: "VE" }, chaqueta: null },
    });
    expect(v.familiares[0].titulo).toBe("Ana Pérez");
    expect(v.familiares[0].filas).toContainEqual({ etiqueta: "Cédula", valor: "Sin cédula (hijo N.º 1)" });
    expect(v.vivienda).toContainEqual({ etiqueta: "Parroquia", valor: "Petare" });
    expect(v.salud).toContainEqual({ etiqueta: "Alergias", valor: "Ninguna" });
    expect(v.salud).toContainEqual({ etiqueta: "Enfermedades crónicas", valor: "Asma" });
    expect(v.tallas).toContainEqual({ etiqueta: "Camisa", valor: "M (VE)" });
    expect(v.tallas).toContainEqual({ etiqueta: "Pantalón", valor: "No informado" });
  });
});
