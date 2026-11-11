import { describe, expect, it } from "vitest";
import { ladoQrMasGrandeMm, qrInsuficiente, type ElementoKonva } from "./disenador";

const el = (t: ElementoKonva["t"], cara: ElementoKonva["cara"], w: number, h: number) =>
  ({ id: `${t}-${cara}-${w}`, t, cara, w, h }) as unknown as ElementoKonva;

describe("QR legible con teléfono (SILOG)", () => {
  it("sin QR el lado más grande es 0 y no cumple", () => {
    expect(ladoQrMasGrandeMm([el("rect", "anverso", 50, 50)])).toBe(0);
    expect(qrInsuficiente([], 20)).toBe(true);
  });

  it("usa el menor lado de cada QR y el mayor entre ambas caras", () => {
    const lista = [el("qr", "anverso", 9.5, 9.5), el("qr", "reverso", 30, 18)];
    expect(ladoQrMasGrandeMm(lista)).toBe(18);
    expect(qrInsuficiente(lista, 20)).toBe(true);
    expect(qrInsuficiente(lista, 18)).toBe(false);
  });

  it("un QR grande en el reverso basta aunque el del anverso sea pequeño", () => {
    expect(qrInsuficiente([el("qr", "anverso", 9, 9), el("qr", "reverso", 20, 20)], 20)).toBe(false);
  });
});
