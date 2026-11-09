import { describe, expect, it } from "vitest";
import { formatearTiempoServicio } from "../domain/formatear-tiempo-servicio";

describe("formatearTiempoServicio (TLF-E)", () => {
  it("maneja casos nulos, indefinidos o menores o iguales a cero", () => {
    expect(formatearTiempoServicio(null)).toBe("0 días de servicio en APN");
    expect(formatearTiempoServicio(undefined)).toBe("0 días de servicio en APN");
    expect(formatearTiempoServicio(0)).toBe("0 días de servicio en APN");
    expect(formatearTiempoServicio(-1)).toBe("0 días de servicio en APN");
  });

  it("formatea casos con fracciones muy pequeñas (días)", () => {
    // 0.0055 * 365 = 2.0075 días -> "2 días de servicio en APN"
    expect(formatearTiempoServicio(0.0055)).toBe("2 días de servicio en APN");
    // 0.0028 * 365 = 1.022 días -> "1 día de servicio en APN"
    expect(formatearTiempoServicio(0.0028)).toBe("1 día de servicio en APN");
    // 0.05 * 365 = 18.25 días -> "18 días de servicio en APN"
    expect(formatearTiempoServicio(0.05)).toBe("18 días de servicio en APN");
  });

  it("formatea meses para períodos menores a 1 año pero mayores o iguales a un mes", () => {
    // 0.25 * 365 = 91 días -> ~3 meses
    expect(formatearTiempoServicio(0.25)).toContain("mes");
    // Nunca debe contener decimales ("0.0055" o ".")
    expect(formatearTiempoServicio(0.25)).not.toMatch(/\d+\.\d+/);
  });

  it("formatea años enteros sin decimales", () => {
    expect(formatearTiempoServicio(1.0)).toBe("1 año de servicio en APN");
    expect(formatearTiempoServicio(2.0)).toBe("2 años de servicio en APN");
    expect(formatearTiempoServicio(15.0)).toBe("15 años de servicio en APN");
  });

  it("formatea años y meses combinados", () => {
    // 1 año y medio (1.5 años = 1 año y 6 meses)
    expect(formatearTiempoServicio(1.5)).toBe("1 año y 6 meses de servicio en APN");
    // 5 años y 3 meses (5.25 años)
    expect(formatearTiempoServicio(5.25)).toBe("5 años y 3 meses de servicio en APN");
    // Nunca debe incluir caracteres de punto decimal
    expect(formatearTiempoServicio(5.25)).not.toMatch(/\d+\.\d+/);
  });
});
