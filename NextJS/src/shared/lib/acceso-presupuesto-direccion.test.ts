import { describe, expect, it } from "vitest";
import { puedeVerRuta } from "./evaluador-iam";

describe("acceso a /presupuesto por permiso", () => {
  it("lo abre quien tiene postulacion.ver_solicitudes", () => {
    for (const ruta of ["/presupuesto", "/presupuesto/solicitudes", "/presupuesto/solicitudes/abc-123"]) {
      expect(puedeVerRuta(["postulacion.ver_solicitudes"], ruta), ruta).toBe(true);
    }
  });

  it("no lo abre quien tiene otros permisos de postulación ni los de Dirección", () => {
    expect(puedeVerRuta(["postulacion.ver_bandeja", "postulacion.ver_ingresos"], "/presupuesto/solicitudes")).toBe(false);
    expect(puedeVerRuta([], "/presupuesto")).toBe(false);
  });
});

describe("acceso a /direccion por permiso", () => {
  it("lo abre quien tiene postulacion.ver_ingresos", () => {
    for (const ruta of ["/direccion", "/direccion/ingresos", "/direccion/ingresos/abc-123"]) {
      expect(puedeVerRuta(["postulacion.ver_ingresos"], ruta), ruta).toBe(true);
    }
  });

  it("no lo abre quien tiene otros permisos", () => {
    expect(puedeVerRuta(["postulacion.ver_solicitudes", "postulacion.ver_bandeja"], "/direccion/ingresos")).toBe(false);
    expect(puedeVerRuta([], "/direccion")).toBe(false);
  });

  it("las notificaciones de ambos módulos dependen de su permiso propio", () => {
    expect(puedeVerRuta(["notificaciones.ver_propias"], "/presupuesto/notificaciones")).toBe(true);
    expect(puedeVerRuta(["notificaciones.ver_propias"], "/direccion/notificaciones")).toBe(true);
  });
});
