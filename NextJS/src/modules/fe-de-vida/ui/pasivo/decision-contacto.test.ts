import { describe, expect, it } from "vitest";

import { resolverOpcionesContacto } from "./decision-contacto";

describe("resolverOpcionesContacto (O39 / U1)", () => {
  it("sin «No tiene correo» exige el correo alternativo", () => {
    const resultado = resolverOpcionesContacto({
      correoAlternativo: "  ",
      permiteSinCorreo: false,
      sinCorreo: false,
      justificacion: "",
    });
    expect(resultado).toEqual({ error: "El correo alternativo es obligatorio para la fe de vida." });
  });

  it("acepta un correo alternativo", () => {
    const resultado = resolverOpcionesContacto({
      correoAlternativo: "pasivo@correo.test",
      permiteSinCorreo: true,
      sinCorreo: false,
      justificacion: "",
    });
    expect(resultado).toEqual({
      opciones: { sinCorreoAlternativo: false, justificacionSinCorreo: "" },
    });
  });

  it("en línea permite «No tiene correo» con justificación suficiente (U1)", () => {
    const valida = resolverOpcionesContacto({
      correoAlternativo: "",
      permiteSinCorreo: true,
      sinCorreo: true,
      justificacion: "  El pasivo no posee correo electrónico ni familiar de contacto.  ",
    });
    expect(valida).toEqual({
      opciones: {
        sinCorreoAlternativo: true,
        justificacionSinCorreo: "El pasivo no posee correo electrónico ni familiar de contacto.",
      },
    });
  });

  it("con «No tiene correo» exige justificación de al menos 10 caracteres", () => {
    const corta = resolverOpcionesContacto({
      correoAlternativo: "",
      permiteSinCorreo: true,
      sinCorreo: true,
      justificacion: "corto",
    });
    expect("error" in corta).toBe(true);
  });

  it("con «No tiene correo» desmarcado igualmente se exige el alternativo", () => {
    const resultado = resolverOpcionesContacto({
      correoAlternativo: "",
      permiteSinCorreo: true,
      sinCorreo: false,
      justificacion: "",
    });
    expect("error" in resultado).toBe(true);
  });
});
