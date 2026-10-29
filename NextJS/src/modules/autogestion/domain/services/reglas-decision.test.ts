import { describe, expect, it } from "vitest";
import {
  cambiosPendientes,
  puedeAprobarCambio,
  resultadoDecision,
  validarDecisiones,
} from "./reglas-decision";
import { cambioFake } from "./fixtures-solicitud";

const A = cambioFake({ id: "a", campo: "telefono_movil" });
const B = cambioFake({ id: "b", campo: "telefono_habitacion" });

describe("validarDecisiones", () => {
  it("exige cubrir todos los cambios pendientes", () => {
    const errores = validarDecisiones([A, B], [{ cambioId: "a", aprobado: true, motivo: "" }], "");
    expect(errores).toHaveLength(1);
    expect(errores[0]).toContain("Falta decidir 1 campo");
  });
  it("rechazar un campo exige motivo", () => {
    const errores = validarDecisiones(
      [A, B],
      [
        { cambioId: "a", aprobado: true, motivo: "" },
        { cambioId: "b", aprobado: false, motivo: "  " },
      ],
      "",
    );
    expect(errores).toEqual(["Indique el motivo del rechazo del campo «telefono_habitacion»."]);
  });
  it("no permite aprobar un campo en conflicto", () => {
    const conflicto = cambioFake({ id: "c", conflicto: true });
    expect(puedeAprobarCambio(conflicto)).toBe(false);
    const errores = validarDecisiones(
      [conflicto],
      [{ cambioId: "c", aprobado: true, motivo: "" }],
      "",
    );
    expect(errores[0]).toContain("solo puede rechazarse");
  });
  it("sin ningún campo aprobado exige el motivo general", () => {
    const decisiones = [{ cambioId: "a", aprobado: false, motivo: "No coincide" }];
    expect(validarDecisiones([A], decisiones, "")).toEqual([
      "Si no se aprueba ningún campo, indique el motivo general del rechazo.",
    ]);
    expect(validarDecisiones([A], decisiones, "Documento ilegible")).toEqual([]);
  });
  it("una aprobación completa no genera errores y los ya decididos se ignoran", () => {
    const decidido = cambioFake({ id: "z", decision: "APROBADO" });
    expect(cambiosPendientes([A, decidido])).toHaveLength(1);
    expect(
      validarDecisiones([A, decidido], [{ cambioId: "a", aprobado: true, motivo: "" }], ""),
    ).toEqual([]);
  });
});

describe("resultadoDecision", () => {
  it("distingue total, parcial y rechazo", () => {
    const si = { cambioId: "a", aprobado: true, motivo: "" };
    const no = { cambioId: "b", aprobado: false, motivo: "x" };
    expect(resultadoDecision([si, { ...si, cambioId: "b" }])).toBe("TOTAL");
    expect(resultadoDecision([si, no])).toBe("PARCIAL");
    expect(resultadoDecision([no])).toBe("RECHAZO");
  });
});
