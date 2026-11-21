import { describe, expect, it } from "vitest";
import { maxAgeDeSesion, sesionVencida } from "./vigencia-sesion";

const AHORA = Date.UTC(2026, 10, 21, 12, 0, 0);
const enSegundos = (s: number) => Math.floor(AHORA / 1000) + s;

describe("vigencia de la sesión del postulante", () => {
  it("el personal conserva el maxAge general", () => {
    expect(maxAgeDeSesion(undefined, 28_800, AHORA)).toBe(28_800);
  });

  it("el postulante nunca dura más que su token", () => {
    expect(maxAgeDeSesion({ expiraEl: enSegundos(7200) }, 28_800, AHORA)).toBe(7200);
    expect(maxAgeDeSesion({ expiraEl: enSegundos(600) }, 28_800, AHORA)).toBe(600);
  });

  it("nunca supera el máximo general ni baja de 1 s", () => {
    expect(maxAgeDeSesion({ expiraEl: enSegundos(99_999) }, 28_800, AHORA)).toBe(28_800);
    expect(maxAgeDeSesion({ expiraEl: enSegundos(-50) }, 28_800, AHORA)).toBe(1);
  });

  it("detecta el vencimiento", () => {
    expect(sesionVencida(enSegundos(1), AHORA)).toBe(false);
    expect(sesionVencida(enSegundos(0), AHORA)).toBe(true);
    expect(sesionVencida(enSegundos(-5), AHORA)).toBe(true);
  });
});
