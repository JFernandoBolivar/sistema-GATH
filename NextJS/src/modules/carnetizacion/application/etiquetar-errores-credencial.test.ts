import { describe, expect, it } from "vitest";
import { mensajeErrorCredencial } from "./etiquetar-errores-credencial";

describe("mensajeErrorCredencial", () => {
  it("nombra el campo vacío", () => {
    expect(
      mensajeErrorCredencial({ error: "Datos inválidos", errores: { documento: ["Este campo no puede estar en blanco."] } }, true),
    ).toBe("Indique la cédula del trabajador.");
    expect(
      mensajeErrorCredencial({ error: "x", errores: { vigencia_hasta: ["Este campo es requerido."] } }, true),
    ).toBe("Indique las horas de vigencia.");
  });
  it("antepone el campo a otros errores y respeta el mensaje sin campos", () => {
    expect(mensajeErrorCredencial({ error: "x", errores: { correo: ["Introduzca una dirección de correo electrónico válida."] } })).toBe(
      "El correo: Introduzca una dirección de correo electrónico válida.",
    );
    expect(mensajeErrorCredencial({ error: "Fallo" })).toBe("Fallo");
  });
});
