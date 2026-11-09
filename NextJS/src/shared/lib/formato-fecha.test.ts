import { describe, expect, it } from "vitest";

import { calcularEdadExacta, formatearFecha, formatearFechaConEdad } from "./formato-fecha";

describe("formatearFecha", () => {
  it("formatea una fecha ISO a dd/MM/yyyy en UTC", () => {
    expect(formatearFecha("2020-01-15")).toBe("15/01/2020");
  });

  it("no se desplaza de día por la zona horaria local (siempre UTC)", () => {
    expect(formatearFecha("2020-01-01")).toBe("01/01/2020");
    expect(formatearFecha("2020-12-31")).toBe("31/12/2020");
  });

  it("devuelve N/A por defecto cuando la fecha es null, undefined o vacía", () => {
    expect(formatearFecha(null)).toBe("N/A");
    expect(formatearFecha(undefined)).toBe("N/A");
    expect(formatearFecha("")).toBe("N/A");
  });

  it("acepta un valor de reemplazo distinto para fecha ausente", () => {
    expect(formatearFecha(null, "Presente")).toBe("Presente");
    expect(formatearFecha(undefined, "Indefinido")).toBe("Indefinido");
  });

  it("devuelve el valor original cuando no es una fecha parseable", () => {
    expect(formatearFecha("no-es-una-fecha")).toBe("no-es-una-fecha");
  });

  it("devuelve valorPorDefecto cuando la fecha es 'nan'", () => {
    expect(formatearFecha("nan")).toBe("N/A");
  });
});

describe("calcularEdadExacta", () => {
  it("calcula la edad correctamente según el año actual", () => {
    const edad = calcularEdadExacta("2004-06-20");
    expect(edad).toBeTypeOf("number");
    expect(edad).toBeGreaterThanOrEqual(20);
  });

  it("retorna null para fechas nulas, inválidas o 'nan'", () => {
    expect(calcularEdadExacta(null)).toBeNull();
    expect(calcularEdadExacta(undefined)).toBeNull();
    expect(calcularEdadExacta("nan")).toBeNull();
    expect(calcularEdadExacta("invalida")).toBeNull();
  });
});

describe("formatearFechaConEdad", () => {
  it("formatea la fecha e incluye la edad en años", () => {
    const resultado = formatearFechaConEdad("2004-06-20");
    expect(resultado).toMatch(/^20\/06\/2004 \(\d+ años\)$/);
  });

  it("devuelve 'No posee' por defecto si es nula o 'nan'", () => {
    expect(formatearFechaConEdad(null)).toBe("No posee");
    expect(formatearFechaConEdad("nan")).toBe("No posee");
  });
});
