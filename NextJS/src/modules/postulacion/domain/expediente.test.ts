import { describe, expect, it } from "vitest";
import { cuentaRegresiva, describirEstado, puedeEditar } from "./expediente";

const AHORA = new Date("2026-11-21T12:00:00Z");
const en = (ms: number) => new Date(AHORA.getTime() + ms).toISOString();
const H = 3_600_000;

describe("cuenta regresiva", () => {
  it("días y horas con tono tranquilo cuando sobra tiempo", () => {
    const c = cuentaRegresiva(en(5 * 24 * H + 3 * H), AHORA)!;
    expect(c.texto).toBe("Te quedan 5 días y 3 horas para completar tus datos.");
    expect(c.urgencia).toBe("tranquilo");
  });

  it("singular y tono «pronto» con menos de 3 días", () => {
    const c = cuentaRegresiva(en(24 * H), AHORA)!;
    expect(c.texto).toContain("1 día");
    expect(c.urgencia).toBe("pronto");
  });

  it("horas y minutos cuando falta menos de un día", () => {
    const c = cuentaRegresiva(en(2 * H + 15 * 60_000), AHORA)!;
    expect(c.texto).toContain("2 horas y 15 minutos");
    expect(c.urgencia).toBe("urgente");
  });

  it("vencida remite a Captación", () => {
    const c = cuentaRegresiva(en(-1000), AHORA)!;
    expect(c.vencida).toBe(true);
    expect(c.texto).toMatch(/Captación/);
  });

  it("sin fecha o con fecha inválida no muestra nada", () => {
    expect(cuentaRegresiva(null, AHORA)).toBeNull();
    expect(cuentaRegresiva("basura", AHORA)).toBeNull();
  });
});

describe("estado en lenguaje claro", () => {
  it("EN_CAPTURA se lee «En captura» y es editable", () => {
    expect(describirEstado("EN_CAPTURA").etiqueta).toBe("En captura");
    expect(puedeEditar("EN_CAPTURA")).toBe(true);
    expect(puedeEditar("EN_CORRECCION_DATOS")).toBe(true);
  });

  it("después de enviar ya no se edita", () => {
    expect(puedeEditar("ENVIADO_CAPTACION")).toBe(false);
    expect(describirEstado("ENVIADO_CAPTACION").paso).toBe(1);
  });

  it("un estado desconocido no rompe la pantalla", () => {
    expect(describirEstado("NUEVO").etiqueta).toBe("NUEVO");
  });
});
