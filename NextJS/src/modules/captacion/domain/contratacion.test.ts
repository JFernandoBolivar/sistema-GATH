import { describe, expect, it } from "vitest";
import { mensajeErrorContratacion, resumenAntesDeContratar, rutaFichaTrabajador, textoCuenta, type CuentaContratacion } from "./contratacion";

const cuenta = (c: Partial<CuentaContratacion>): CuentaContratacion => ({
  creada: false, reactivada: false, motivo: "", correo: null, correoAlternativo: null, diasVigenciaClaveInicial: null, entrega: null, ...c,
});

describe("texto de la cuenta tras contratar", () => {
  it("cuenta creada usa la entrega del servidor", () => {
    const t = textoCuenta(cuenta({ creada: true, entrega: "Cuenta creada: la contraseña inicial es la cédula." }));
    expect(t).toMatchObject({ titulo: "Cuenta de acceso creada", tono: "exito" });
    expect(t.detalle).toMatch(/contraseña inicial es la cédula/);
  });
  it("sin correo institucional explica qué falta", () => {
    const t = textoCuenta(cuenta({ motivo: "sin_correo_institucional", correoAlternativo: "a@ejemplo.invalid" }));
    expect(t.tono).toBe("atencion");
    expect(t.detalle).toMatch(/cuando RRHH asigne el correo institucional/);
    expect(t.detalle).toMatch(/a@ejemplo\.invalid/);
  });
  it("sin correo, ya existía, reactivada y desconocido", () => {
    expect(textoCuenta(cuenta({ motivo: "sin_correo" })).detalle).toMatch(/ningún correo/);
    expect(textoCuenta(cuenta({ motivo: "ya_existia" })).titulo).toBe("Ya tenía cuenta");
    expect(textoCuenta(cuenta({ reactivada: true })).titulo).toBe("Cuenta reactivada");
    expect(textoCuenta(cuenta({ motivo: "otro_motivo" })).detalle).toMatch(/otro motivo/);
  });
});

describe("errores de contratación", () => {
  it("traduce los códigos conocidos y cae al mensaje del servidor", () => {
    expect(mensajeErrorContratacion("PUESTO_NO_DISPONIBLE", "x")).toMatch(/ya no está disponible/);
    expect(mensajeErrorContratacion("EMPLEADO_ACTIVO", "x")).toMatch(/trabajador activo/);
    expect(mensajeErrorContratacion("RARO", "Mensaje del servidor")).toBe("Mensaje del servidor");
    expect(mensajeErrorContratacion(undefined, "")).toMatch(/No fue posible/);
  });
  it("la ficha se abre por cédula y el resumen menciona el puesto", () => {
    expect(rutaFichaTrabajador("V-123")).toBe("/personal/consultar?cedula=V-123");
    expect(resumenAntesDeContratar("P-001").join(" ")).toMatch(/P-001/);
  });
});
