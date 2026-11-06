/**
 * Filtro «Cuenta de acceso» del listado de pasivos (FIX-QA16).
 *
 * Tres estados en la UI ↔ `sinCuenta` del dominio:
 *  - "todos"      → sin filtro (`undefined`)
 *  - "con_cuenta" → `false`
 *  - "sin_cuenta" → `true`
 */
export type FiltroCuenta = "todos" | "con_cuenta" | "sin_cuenta";

export function filtroCuentaASinCuenta(valor: FiltroCuenta): boolean | undefined {
  if (valor === "sin_cuenta") return true;
  if (valor === "con_cuenta") return false;
  return undefined;
}

export function sinCuentaAFiltroCuenta(valor: boolean | undefined): FiltroCuenta {
  if (valor === true) return "sin_cuenta";
  if (valor === false) return "con_cuenta";
  return "todos";
}
