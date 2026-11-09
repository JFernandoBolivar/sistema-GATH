import { describe, expect, it } from "vitest";

import { filtroCuentaASinCuenta, sinCuentaAFiltroCuenta } from "./filtro-cuenta";

describe("filtro «Cuenta de acceso» (FIX-QA16)", () => {
  it("traduce las tres opciones al filtro del dominio", () => {
    expect(filtroCuentaASinCuenta("todos")).toBeUndefined();
    expect(filtroCuentaASinCuenta("con_cuenta")).toBe(false);
    expect(filtroCuentaASinCuenta("sin_cuenta")).toBe(true);
  });

  it("refleja el filtro del dominio en la opción seleccionada", () => {
    expect(sinCuentaAFiltroCuenta(undefined)).toBe("todos");
    expect(sinCuentaAFiltroCuenta(false)).toBe("con_cuenta");
    expect(sinCuentaAFiltroCuenta(true)).toBe("sin_cuenta");
  });

  it("hace ida y vuelta sin perder el estado", () => {
    for (const opcion of ["todos", "con_cuenta", "sin_cuenta"] as const) {
      expect(sinCuentaAFiltroCuenta(filtroCuentaASinCuenta(opcion))).toBe(opcion);
    }
  });
});
