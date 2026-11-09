import { describe, expect, it } from "vitest";

import { destinoInterno, rutaActual } from "./enlace-notificacion";

describe("destinoInterno (FIX-QA18)", () => {
  it("acepta rutas internas con búsqueda y ancla", () => {
    expect(destinoInterno("/personal/consultar")).toBe("/personal/consultar");
    expect(destinoInterno("/personal/bienestar/solicitudes/abc?x=1")).toBe(
      "/personal/bienestar/solicitudes/abc?x=1",
    );
    expect(destinoInterno("/movimientos#hoy")).toBe("/movimientos#hoy");
  });

  it("rechaza enlaces vacíos, externos y esquemas peligrosos", () => {
    expect(destinoInterno("")).toBeNull();
    expect(destinoInterno(null)).toBeNull();
    expect(destinoInterno("https://evil.example/x")).toBeNull();
    expect(destinoInterno("//evil.example/x")).toBeNull();
    expect(destinoInterno("javascript:alert(1)")).toBeNull();
    expect(destinoInterno("#ancla")).toBeNull();
  });
});

describe("rutaActual", () => {
  it("compone ruta, búsqueda y ancla", () => {
    expect(rutaActual({ pathname: "/x", search: "?a=1", hash: "#b" })).toBe("/x?a=1#b");
    expect(rutaActual({ pathname: "/x", search: "", hash: "" })).toBe("/x");
  });
});
