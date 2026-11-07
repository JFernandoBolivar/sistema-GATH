import { describe, expect, it } from "vitest";

import { resolverOpcionesContacto } from "./decision-contacto";

describe("resolverOpcionesContacto (O39)", () => {
  it("en línea exige el correo alternativo", () => {
    const resultado = resolverOpcionesContacto({
      correoAlternativo: "  ",
      permiteSinCorreo: false,
      sinCorreo: false,
      justificacion: "",
    });
    expect(resultado).toEqual({ error: "El correo alternativo es obligatorio para la fe de vida." });
  });

  it("en línea acepta un correo alternativo", () => {
    const resultado = resolverOpcionesContacto({
      correoAlternativo: "pasivo@correo.test",
      permiteSinCorreo: false,
      sinCorreo: false,
      justificacion: "",
    });
    expect(resultado).toEqual({
      opciones: { sinCorreoAlternativo: false, justificacionSinCorreo: "" },
    });
  });

  it("en presencial «No tiene correo» exige justificación suficiente", () => {
    const corta = resolverOpcionesContacto({
      correoAlternativo: "",
      permiteSinCorreo: true,
      sinCorreo: true,
      justificacion: "corto",
    });
    expect("error" in corta).toBe(true);

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

  it("en presencial sin marcar «No tiene correo» igualmente se exige el alternativo", () => {
    const resultado = resolverOpcionesContacto({
      correoAlternativo: "",
      permiteSinCorreo: true,
      sinCorreo: false,
      justificacion: "",
    });
    expect("error" in resultado).toBe(true);
  });
});
