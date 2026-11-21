import { describe, expect, it } from "vitest";
import { ESTADOS_PSICOFISICO_EDITABLE, MAX_BYTES_INFORME, validarPsicofisico } from "./psicofisico";

const HOY = "2026-11-21";
const base = { resultado: "APTO" as const, fechaAplicacion: "2026-11-20", observaciones: "", informe: null };

describe("validación del psicofísico", () => {
  it("acepta resultado y fecha pasada", () => {
    expect(validarPsicofisico(base, HOY)).toEqual({});
  });
  it("exige resultado y fecha, y rechaza fecha futura", () => {
    expect(validarPsicofisico({ ...base, resultado: "" }, HOY).resultado).toBeTruthy();
    expect(validarPsicofisico({ ...base, fechaAplicacion: "" }, HOY).fechaAplicacion).toBeTruthy();
    expect(validarPsicofisico({ ...base, fechaAplicacion: "2026-11-22" }, HOY).fechaAplicacion).toMatch(/futura/);
  });
  it("el informe debe ser PDF de hasta 10 MB", () => {
    const txt = new File(["x"], "informe.txt", { type: "text/plain" });
    expect(validarPsicofisico({ ...base, informe: txt }, HOY).informe).toMatch(/PDF/);
    const grande = new File([new Uint8Array(MAX_BYTES_INFORME + 1)], "informe.pdf", { type: "application/pdf" });
    expect(validarPsicofisico({ ...base, informe: grande }, HOY).informe).toMatch(/10 MB/);
    const ok = new File(["%PDF"], "informe.pdf", { type: "application/pdf" });
    expect(validarPsicofisico({ ...base, informe: ok }, HOY)).toEqual({});
  });
  it("solo es editable en los estados previos a Presupuesto", () => {
    expect(ESTADOS_PSICOFISICO_EDITABLE.has("ENVIADO_CAPTACION")).toBe(true);
    expect(ESTADOS_PSICOFISICO_EDITABLE.has("EN_PRESUPUESTO")).toBe(false);
  });
});
