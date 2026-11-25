import { describe, expect, it } from "vitest";
import { avisoReingresoPasivo } from "./reingreso-pasivo";

describe("avisoReingresoPasivo", () => {
  it("explica qué ocurrirá al contratar según la opción del expediente", () => {
    expect(avisoReingresoPasivo("permitir")).toMatch(/se deja como está/);
    expect(avisoReingresoPasivo("cerrar_al_contratar")).toMatch(/cerrará su condición de pasivo/);
    expect(avisoReingresoPasivo("no_permitir")).toMatch(/no admitir pasivos/);
  });

  it("un valor desconocido cuenta como «permitir»", () => {
    expect(avisoReingresoPasivo("otra")).toBe(avisoReingresoPasivo("permitir"));
  });
});
