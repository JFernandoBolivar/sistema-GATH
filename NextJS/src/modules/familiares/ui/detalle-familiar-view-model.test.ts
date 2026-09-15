import { describe, expect, it } from "vitest";

import { etiquetaDocumento, fechaLegible } from "./detalle-familiar-view-model";

describe("fechaLegible", () => {
  it("formatea una fecha ISO a dd/mm/aaaa", () => {
    expect(fechaLegible("2020-01-15")).toBe("15/01/2020");
  });

  it("devuelve N/A cuando la fecha es null o undefined", () => {
    expect(fechaLegible(null)).toBe("N/A");
    expect(fechaLegible(undefined)).toBe("N/A");
  });

  it("devuelve el valor original cuando no es una fecha parseable", () => {
    expect(fechaLegible("no-es-una-fecha")).toBe("no-es-una-fecha");
  });
});

describe("etiquetaDocumento", () => {
  it("traduce los tipos conocidos a una etiqueta legible", () => {
    expect(etiquetaDocumento("cedula")).toBe("Cédula del familiar");
    expect(etiquetaDocumento("partida_nacimiento")).toBe("Partida de nacimiento");
  });

  it("devuelve el tipo tal cual cuando no está en el catálogo de etiquetas", () => {
    expect(etiquetaDocumento("otro_tipo")).toBe("otro_tipo");
  });
});
