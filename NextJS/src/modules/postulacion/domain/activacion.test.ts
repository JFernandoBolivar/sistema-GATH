import { describe, expect, it } from "vitest";
import { esquemaActivacion, reglasDeActivacion, tokenConForma } from "./activacion";
import { codigoDeEnlace, enlaceAgotado, mensajeDeEnlace, PEDIR_ENLACE_NUEVO } from "./errores-enlace";

const OK = { cedula: "12345678", claveNueva: "Clave2026Segura", confirmacion: "Clave2026Segura" };

describe("esquema de activación", () => {
  it("acepta cédula, contraseña válida y confirmación igual", () => {
    expect(esquemaActivacion.safeParse(OK).success).toBe(true);
  });

  it("exige la cédula numérica", () => {
    const r = esquemaActivacion.safeParse({ ...OK, cedula: "V-123" });
    expect(r.success).toBe(false);
    expect(esquemaActivacion.safeParse({ ...OK, cedula: "" }).success).toBe(false);
  });

  it.each([
    ["corta1", "longitud"],
    ["sololetrasenlaclave", "números"],
    ["12345678901234", "letras"],
    ["Clave12345678xx", "cédula"],
  ])("rechaza la contraseña «%s» (%s)", (claveNueva) => {
    const r = esquemaActivacion.safeParse({ ...OK, claveNueva, confirmacion: claveNueva });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === "claveNueva")).toBe(true);
  });

  it("exige que la confirmación coincida", () => {
    const r = esquemaActivacion.safeParse({ ...OK, confirmacion: "Otra2026Clave" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]).toMatchObject({ path: ["confirmacion"], message: "Las contraseñas no coinciden." });
  });

  it("las reglas visibles no incluyen «distinta de la temporal»", () => {
    const { reglas, valida } = reglasDeActivacion("Clave2026Segura", "12345678");
    expect(reglas.map((r) => r.id)).toEqual(["longitud", "letra", "numero", "sin_cedula"]);
    expect(valida).toBe(true);
    expect(reglasDeActivacion("", "12345678").valida).toBe(false);
  });
});

describe("token del enlace", () => {
  it("solo pasa la forma de un token urlsafe largo", () => {
    expect(tokenConForma("a".repeat(43))).toBe(true);
    expect(tokenConForma("abc")).toBe(false);
    expect(tokenConForma("con espacios y ñ ".repeat(3))).toBe(false);
    expect(tokenConForma(undefined)).toBe(false);
  });
});

describe("errores del enlace", () => {
  it("usa el código del servidor y, sin él, el estado HTTP", () => {
    expect(codigoDeEnlace(410, "ENLACE_USADO")).toBe("ENLACE_USADO");
    expect(codigoDeEnlace(400, "ACTIVACION_DATOS_INCORRECTOS")).toBe("ACTIVACION_DATOS_INCORRECTOS");
    expect(codigoDeEnlace(429, undefined)).toBe("DEMASIADOS_INTENTOS");
    expect(codigoDeEnlace(404, undefined)).toBe("ENLACE_INVALIDO");
    expect(codigoDeEnlace(0, "SERVICIO_NO_DISPONIBLE")).toBe("SERVICIO_NO_DISPONIBLE");
    expect(codigoDeEnlace(500, "LO_QUE_SEA")).toBe("SERVICIO_NO_DISPONIBLE");
  });

  it("los cuatro códigos del enlace agotan el enlace; la cédula equivocada no", () => {
    for (const c of ["ENLACE_INVALIDO", "ENLACE_VENCIDO", "ENLACE_USADO", "ENLACE_BLOQUEADO"]) expect(enlaceAgotado(c)).toBe(true);
    expect(enlaceAgotado("ACTIVACION_DATOS_INCORRECTOS")).toBe(false);
    expect(enlaceAgotado(undefined)).toBe(false);
  });

  it("cada error tiene un mensaje amable y no culpa a la persona", () => {
    expect(mensajeDeEnlace("ENLACE_VENCIDO").titulo).toMatch(/venció/);
    expect(mensajeDeEnlace("ENLACE_USADO").detalle).toMatch(/ingresa/);
    expect(mensajeDeEnlace("ACTIVACION_DATOS_INCORRECTOS").titulo).not.toMatch(/incorrecta|inválida/i);
    expect(PEDIR_ENLACE_NUEVO).toBe("Pide a Captación un enlace nuevo.");
  });
});
