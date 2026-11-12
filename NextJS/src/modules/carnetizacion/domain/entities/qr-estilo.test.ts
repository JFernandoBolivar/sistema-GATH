import { describe, expect, it } from "vitest";

import {
  aplicarPresetQr,
  normalizarQrEstilo,
  personalizarQr,
  QR_LOGO_PCT_MAX,
  QR_LOGO_PCT_MIN,
} from "./qr-estilo";

describe("estilo del QR", () => {
  it("sin estilo equivale a institucional", () => {
    const e = normalizarQrEstilo(undefined);
    expect(e.preset).toBe("institucional");
    expect(e.color_ojo_centro).toBe("#C8102E");
    expect(e.logo).toEqual({ activo: true, medio_id: null, tamano_pct: 23 });
  });

  it("limita el tamaño del logo a 15-24 % y descarta colores inválidos", () => {
    expect(normalizarQrEstilo({ logo: { tamano_pct: 90 } }).logo.tamano_pct).toBe(QR_LOGO_PCT_MAX);
    expect(normalizarQrEstilo({ logo: { tamano_pct: 1 } }).logo.tamano_pct).toBe(QR_LOGO_PCT_MIN);
    const e = normalizarQrEstilo({ preset: "personalizado", color_modulos: "rojo" });
    expect(e.color_modulos).toBe("#1B2A4A");
  });

  it("un preset conserva el logo elegido y cambiar un color pasa a personalizado", () => {
    const base = normalizarQrEstilo({ logo: { activo: true, medio_id: "m1", tamano_pct: 18 } });
    const degradado = aplicarPresetQr(base, "degradado");
    expect(degradado.preset).toBe("degradado");
    expect(degradado.color_modulos_2).toBe("#1B2A4A");
    expect(degradado.logo.medio_id).toBe("m1");
    expect(personalizarQr(degradado, { color_modulos: "#000000" }).preset).toBe("personalizado");
  });
});
