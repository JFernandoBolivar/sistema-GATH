import { describe, expect, it } from "vitest";
import { actualizarConfiguracionVisualSchema } from "./schema-configuracion-visual";

describe("actualizarConfiguracionVisualSchema", () => {
  it("acepta un color hex de 6 dígitos", () => {
    const r = actualizarConfiguracionVisualSchema.safeParse({ colorFondo: "#1E3A8A" });
    expect(r.success).toBe(true);
  });

  it("acepta un color hex de 8 dígitos (con alfa)", () => {
    const r = actualizarConfiguracionVisualSchema.safeParse({ colorFondo: "#1E3A8AFF" });
    expect(r.success).toBe(true);
  });

  it("rechaza un color sin el formato hexadecimal", () => {
    const r = actualizarConfiguracionVisualSchema.safeParse({ colorFondo: "azul" });
    expect(r.success).toBe(false);
  });

  it("rechaza un nombre de empresa mas largo de 200 caracteres", () => {
    const r = actualizarConfiguracionVisualSchema.safeParse({ nombreEmpresa: "a".repeat(201) });
    expect(r.success).toBe(false);
  });

  it("acepta tipoCintillo GENERICO o FIJO", () => {
    expect(actualizarConfiguracionVisualSchema.safeParse({ tipoCintillo: "GENERICO" }).success).toBe(true);
    expect(actualizarConfiguracionVisualSchema.safeParse({ tipoCintillo: "FIJO" }).success).toBe(true);
    expect(actualizarConfiguracionVisualSchema.safeParse({ tipoCintillo: "OTRO" }).success).toBe(false);
  });
});
