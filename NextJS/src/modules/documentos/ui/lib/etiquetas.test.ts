import { describe, expect, it } from "vitest";

import { estaPublicada, textoEstado } from "./etiquetas";

describe("textoEstado", () => {
  it("una plantilla sembrada en borrador (versión 0) no figura como publicada", () => {
    const p = { estado: "borrador" as const, ultima_version: 0, cambios_sin_publicar: false };
    expect(estaPublicada(p)).toBe(false);
    expect(textoEstado(p)).toBe("Borrador (sin publicar)");
  });
  it("sin versión (null) también es borrador", () => {
    expect(textoEstado({ estado: "borrador", ultima_version: null, cambios_sin_publicar: false })).toBe("Borrador (sin publicar)");
  });
  it("con versiones publicadas indica la vigente", () => {
    expect(textoEstado({ estado: "publicada", ultima_version: 3, cambios_sin_publicar: false })).toBe("Publicada v3");
  });
  it("con cambios sin publicar conserva la versión vigente", () => {
    expect(textoEstado({ estado: "publicada", ultima_version: 2, cambios_sin_publicar: true })).toBe("Borrador con cambios (vigente v2)");
  });
});
