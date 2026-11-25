import { describe, expect, it } from "vitest";
import { bloqueosVisibles, pestanaDeBloqueo } from "./bloqueos";

describe("bloqueos", () => {
  it("reconoce la pestaña", () => {
    expect(pestanaDeBloqueo("Falta registrar el resultado psicofísico.")).toBe("psicofisico");
    expect(pestanaDeBloqueo("Otra cosa")).toBeNull();
  });
  it("agrupa causas repetidas", () => {
    const a = { destino: "X", etiqueta: "A", requiereMotivo: false, requierePropuesta: false, bloqueada: true, motivoBloqueo: "Falta la foto.", sugerida: false };
    expect(bloqueosVisibles([a, { ...a, destino: "Y" }, { ...a, bloqueada: false }])).toHaveLength(1);
  });
});
