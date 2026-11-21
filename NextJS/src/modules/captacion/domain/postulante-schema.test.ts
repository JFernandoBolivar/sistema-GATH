import { describe, expect, it } from "vitest";
import { esquemaNuevoPostulante } from "./postulante-schema";

const valido = { cedula: "18123456", nombres: "María José", apellidos: "Pérez D'Amico", correo: "", telefonoMovil: "" };

function mensajes(entrada: Record<string, string>): Record<string, string> {
  const r = esquemaNuevoPostulante.safeParse({ ...valido, ...entrada });
  if (r.success) return {};
  const por: Record<string, string> = {};
  for (const i of r.error.issues) por[String(i.path[0])] ??= i.message;
  return por;
}

describe("validación de «Nuevo postulante»", () => {
  it("acepta datos mínimos válidos (correo y teléfono opcionales)", () => {
    expect(esquemaNuevoPostulante.safeParse(valido).success).toBe(true);
  });

  it("exige cédula numérica", () => {
    expect(mensajes({ cedula: "" }).cedula).toBeTruthy();
    expect(mensajes({ cedula: "V18123456" }).cedula).toBeTruthy();
    expect(mensajes({ cedula: "123" }).cedula).toBeTruthy();
  });

  it("nombres y apellidos solo admiten letras y espacios", () => {
    expect(mensajes({ nombres: "Juan3" }).nombres).toMatch(/solo se admiten letras y espacios/i);
    expect(mensajes({ apellidos: "Pérez#" }).apellidos).toMatch(/solo se admiten letras y espacios/i);
    expect(mensajes({ nombres: "  " }).nombres).toMatch(/indique/i);
  });

  it("valida el correo solo si se escribe", () => {
    expect(mensajes({ correo: "no-es-correo" }).correo).toBeTruthy();
    expect(mensajes({ correo: "ana@conatel.gob.ve" }).correo).toBeUndefined();
  });

  it("valida el teléfono móvil solo si se escribe", () => {
    expect(mensajes({ telefonoMovil: "123" }).telefonoMovil).toBeTruthy();
    expect(mensajes({ telefonoMovil: "+584121234567" }).telefonoMovil).toBeUndefined();
  });
});
