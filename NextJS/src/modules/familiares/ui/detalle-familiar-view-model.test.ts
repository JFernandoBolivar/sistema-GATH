import { describe, expect, it } from "vitest";

import { etiquetaDocumento } from "./detalle-familiar-view-model";

describe("etiquetaDocumento", () => {
  it("traduce los tipos conocidos a una etiqueta legible", () => {
    expect(etiquetaDocumento("cedula")).toBe("Cédula del familiar");
    expect(etiquetaDocumento("partida_nacimiento")).toBe("Partida de nacimiento");
  });

  it("devuelve el tipo tal cual cuando no está en el catálogo de etiquetas", () => {
    expect(etiquetaDocumento("otro_tipo")).toBe("otro_tipo");
  });
});
