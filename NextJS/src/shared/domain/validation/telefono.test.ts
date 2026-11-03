import { describe, expect, it } from "vitest";
import {
  formatearTelefono,
  OPERADORAS_VE,
  ZONAS_VE,
  paisDesdeInternacional,
  separarPrefijoVE,
  normalizarTelefono,
  paisesTelefono,
  separarTelefono,
  telefonoZod,
  unirTelefono,
} from "./telefono";

describe("normalizarTelefono (Venezuela por defecto)", () => {
  it.each([
    ["04121234567", "+584121234567"],
    ["0412-1234567", "+584121234567"],
    ["4121234567", "+584121234567"],
    ["+58 412 1234567", "+584121234567"],
    ["0212 1234567", "+582121234567"],
    ["2121234567", "+582121234567"],
  ])("%s → %s", (entrada, e164) => {
    expect(normalizarTelefono(entrada)).toEqual({ ok: true, e164 });
  });

  it("vacío es válido (la obligatoriedad la decide el formulario)", () => {
    expect(normalizarTelefono("")).toEqual({ ok: true, e164: null });
    expect(normalizarTelefono(null)).toEqual({ ok: true, e164: null });
  });

  it("rechaza letras, dígitos de menos o de más", () => {
    expect(normalizarTelefono("0412abc4567").ok).toBe(false);
    expect(normalizarTelefono("041212345").ok).toBe(false);
    expect(normalizarTelefono("041212345678").ok).toBe(false);
    expect(normalizarTelefono("nan").ok).toBe(false);
  });

  it("el campo móvil exige un número móvil", () => {
    expect(normalizarTelefono("0212 1234567", { tipo: "movil" }).ok).toBe(false);
    expect(normalizarTelefono("0414 1234567", { tipo: "movil" })).toEqual({
      ok: true,
      e164: "+584141234567",
    });
  });

  it("valida otros países por su cantidad de dígitos", () => {
    expect(normalizarTelefono("+56 9 8765 4321")).toEqual({ ok: true, e164: "+56987654321" });
    expect(normalizarTelefono("+56 9 1234")).toMatchObject({
      ok: false,
      mensaje: expect.stringMatching(/Chile/),
    });
    expect(normalizarTelefono("+1 202 555 0143")).toEqual({ ok: true, e164: "+12025550143" });
  });
});

describe("formato, separación y unión", () => {
  it("formatea para mostrar y deja tal cual lo que no es un teléfono", () => {
    expect(formatearTelefono("+584121234567")).toBe("+58 412 1234567");
    expect(formatearTelefono("4122295258")).toBe("+58 412 2295258");
    expect(formatearTelefono("nan")).toBe("nan");
    expect(formatearTelefono(null)).toBe("");
  });

  it("separa E.164 y legado en país + número nacional", () => {
    expect(separarTelefono("+56987654321")).toEqual({ pais: "CL", nacional: "987654321" });
    expect(separarTelefono("04121234567")).toEqual({ pais: "VE", nacional: "4121234567" });
    expect(separarTelefono("")).toEqual({ pais: "VE", nacional: "" });
  });

  it("detecta el país cuando se escribe con +código", () => {
    expect(paisDesdeInternacional("+57 300 1234567")).toEqual({
      pais: "CO",
      nacional: "3001234567",
    });
    expect(paisDesdeInternacional("+58 414-1234567")).toEqual({
      pais: "VE",
      nacional: "4141234567",
    });
    expect(paisDesdeInternacional("04141234567")).toBeNull();
  });

  it("une país y número nacional en E.164", () => {
    expect(unirTelefono("VE", "04121234567")).toBe("+584121234567");
    expect(unirTelefono("VE", "")).toBe("");
  });

  it("lista de países con Venezuela primero", () => {
    const paises = paisesTelefono();
    expect(paises[0]).toMatchObject({ codigo: "VE", prefijo: "+58" });
    expect(paises.length).toBeGreaterThan(200);
  });
});

describe("telefonoZod", () => {
  it("opcional acepta vacío y rechaza números inválidos", () => {
    const s = telefonoZod();
    expect(s.safeParse("").success).toBe(true);
    expect(s.safeParse(undefined).success).toBe(true);
    expect(s.safeParse("123").success).toBe(false);
  });

  it("requerido exige el número", () => {
    const s = telefonoZod({ requerido: true });
    expect(s.safeParse("").success).toBe(false);
    expect(s.safeParse("+584121234567").success).toBe(true);
  });
});

describe("códigos de Venezuela", () => {
  it("separa operadora o código de área y los 7 dígitos", () => {
    expect(separarPrefijoVE("4121234567")).toEqual({ prefijo: "0412", numero: "1234567" });
    expect(separarPrefijoVE("04241234567")).toEqual({ prefijo: "0424", numero: "1234567" });
    expect(separarPrefijoVE("2121234567")).toEqual({ prefijo: "0212", numero: "1234567" });
    expect(separarPrefijoVE("9991234567")).toEqual({ prefijo: "", numero: "9991234567" });
  });

  it("tiene operadoras móviles y zonas fijas con nombre", () => {
    expect(OPERADORAS_VE["0414"]).toBe("Movistar");
    expect(ZONAS_VE["0212"]).toMatch(/Caracas/);
    expect(ZONAS_VE["0261"]).toMatch(/Maracaibo/);
  });
});
