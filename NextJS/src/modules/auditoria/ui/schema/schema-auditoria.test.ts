import { describe, expect, it } from "vitest";

import { FILTROS_VACIOS, aFiltros, filtrosAuditoriaSchema } from "./schema-auditoria";

describe("filtros de la bitácora", () => {
  it("acepta filtros vacíos y limpia los valores al enviarlos", () => {
    expect(filtrosAuditoriaSchema.safeParse(FILTROS_VACIOS).success).toBe(true);
    expect(aFiltros(FILTROS_VACIOS)).toEqual({
      usuario: undefined,
      accion: undefined,
      modulo: undefined,
      recurso: undefined,
      ip: undefined,
      desde: undefined,
      hasta: undefined,
      resultado: undefined,
    });
  });

  it("rechaza un rango de fechas invertido", () => {
    const resultado = filtrosAuditoriaSchema.safeParse({
      ...FILTROS_VACIOS,
      desde: "2026-02-01",
      hasta: "2026-01-01",
    });
    expect(resultado.success).toBe(false);
  });

  it("conserva los filtros con valor", () => {
    expect(
      aFiltros({
        ...FILTROS_VACIOS,
        usuario: "12345678",
        resultado: "DENIED",
      }),
    ).toMatchObject({ usuario: "12345678", resultado: "DENIED" });
  });
});
