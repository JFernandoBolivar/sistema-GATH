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
  obtenerAyudaTelefono,
  obtenerEjemploTelefono,
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

  it("el campo móvil en Venezuela rechaza fijo y explica formato esperado", () => {
    const res = normalizarTelefono("0212 1234567", { tipo: "movil" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.mensaje).toMatch(/teléfono fijo/i);
      expect(res.mensaje).toMatch(/0412-1234567/);
    }

    expect(normalizarTelefono("0414 1234567", { tipo: "movil" })).toEqual({
      ok: true,
      e164: "+584141234567",
    });
  });
});

describe("Validación dinámica por país y tipo (FIX-TLF15)", () => {
  it("Albania (AL): error reporta la cantidad de dígitos esperada (9 dígitos)", () => {
    const res = normalizarTelefono("12345", { pais: "AL" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.mensaje).toBe("Número inválido para Albania (+355): se esperan 9 dígitos.");
    }
  });

  it("Albania (AL): detecta número fijo en campo celular y ofrece mensaje específico", () => {
    // 04 222 3456 es una línea fija en Tirana, Albania
    const res = normalizarTelefono("+355 4 222 3456", { tipo: "movil", pais: "AL" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.mensaje).toContain("Este número parece un teléfono fijo.");
      expect(res.mensaje).toContain("Para celular de Albania se esperan 9 dígitos que empiezan por 6");
      expect(res.mensaje).toContain("67 212 3456");
    }
  });

  it("España (ES): error reporta 9 dígitos esperados y detecta fijo en campo móvil", () => {
    const invalido = normalizarTelefono("1234", { pais: "ES" });
    expect(invalido.ok).toBe(false);
    if (!invalido.ok) {
      expect(invalido.mensaje).toBe("Número inválido para España (+34): se esperan 9 dígitos.");
    }

    // 91 123 4567 es línea fija en Madrid, España
    const fijo = normalizarTelefono("+34 911 234 567", { tipo: "movil", pais: "ES" });
    expect(fijo.ok).toBe(false);
    if (!fijo.ok) {
      expect(fijo.mensaje).toContain("Este número parece un teléfono fijo.");
      expect(fijo.mensaje).toContain("Para celular de España se esperan 9 dígitos");
    }

    // Celular en España (comienza por 6)
    const movil = normalizarTelefono("+34 612 345 678", { tipo: "movil", pais: "ES" });
    expect(movil).toEqual({ ok: true, e164: "+34612345678" });
  });

  it("Colombia (CO): valida número móvil y reporta 10 dígitos esperados", () => {
    const invalido = normalizarTelefono("12345", { pais: "CO" });
    expect(invalido.ok).toBe(false);
    if (!invalido.ok) {
      expect(invalido.mensaje).toBe("Número inválido para Colombia (+57): se esperan 10 dígitos.");
    }

    const movilValido = normalizarTelefono("+57 321 1234567", { tipo: "movil", pais: "CO" });
    expect(movilValido).toEqual({ ok: true, e164: "+573211234567" });
  });

  it("Chile (CL): valida formato y dígitos esperados", () => {
    expect(normalizarTelefono("+56 9 8765 4321")).toEqual({ ok: true, e164: "+56987654321" });
    const invalido = normalizarTelefono("+56 9 1234");
    expect(invalido.ok).toBe(false);
    if (!invalido.ok) {
      expect(invalido.mensaje).toMatch(/Chile/);
      expect(invalido.mensaje).toMatch(/9 dígitos/);
    }
  });
});

describe("obtenerAyudaTelefono y obtenerEjemploTelefono (FIX-TLF15)", () => {
  it("devuelve la ayuda tradicional venezolana para VE", () => {
    expect(obtenerAyudaTelefono("VE", "movil")).toBe(
      "Ejemplo: 0412-1234567, 0414-9876543 o 0416-5551234 (11 dígitos).",
    );
    expect(obtenerAyudaTelefono("VE", "fijo")).toBe(
      "Ejemplo: 0212-5551234 o 0241-8765432 (con código de área).",
    );
  });

  it("deriva el ejemplo y longitud dinámica para Albania (AL)", () => {
    const ayuda = obtenerAyudaTelefono("AL", "movil");
    expect(ayuda).toContain("Albania (+355)");
    expect(ayuda).toContain("9 dígitos");
    expect(ayuda).toContain("67 212 3456");

    const ex = obtenerEjemploTelefono("AL");
    expect(ex).toEqual({
      digitos: 9,
      ejemplo: "67 212 3456",
      primerDigito: "6",
    });
  });

  it("deriva el ejemplo y longitud dinámica para Colombia (CO)", () => {
    const ayuda = obtenerAyudaTelefono("CO", "movil");
    expect(ayuda).toContain("Colombia (+57)");
    expect(ayuda).toContain("10 dígitos");
    expect(ayuda).toContain("321 1234567");
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
