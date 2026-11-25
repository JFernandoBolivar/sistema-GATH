import { describe, expect, it } from "vitest";
import { sinJerga } from "./jerga";

describe("sinJerga", () => {
  it("sustituye Ventana 1 y 2", () => {
    expect(sinJerga("Reabrir Ventana 2")).toBe("Reabrir datos complementarios");
    expect(sinJerga("Estado de la Ventana 1")).toBe("Estado de los datos iniciales");
    expect(sinJerga("Ventana 2 incompleta")).toBe("Datos complementarios incompleta");
  });
  it("deja intacto el resto", () => {
    expect(sinJerga("Rechazar")).toBe("Rechazar");
  });
});
