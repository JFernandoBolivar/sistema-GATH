import { describe, expect, it } from "vitest";
import { puedeVerRuta } from "@/shared/lib/evaluador-iam";

describe("acceso a /captacion por permiso", () => {
  it("lo abre quien tiene postulacion.ver_bandeja", () => {
    for (const ruta of ["/captacion", "/captacion/expedientes", "/captacion/expedientes/abc-123"]) {
      expect(puedeVerRuta(["postulacion.ver_bandeja"], ruta), ruta).toBe(true);
    }
  });

  it("no lo abre quien solo tiene otros permisos", () => {
    expect(puedeVerRuta(["personal.ver", "carnetizacion.ver"], "/captacion/expedientes")).toBe(false);
    expect(puedeVerRuta([], "/captacion")).toBe(false);
  });

  it("las notificaciones del módulo dependen de su permiso propio", () => {
    expect(puedeVerRuta(["notificaciones.ver_propias"], "/captacion/notificaciones")).toBe(true);
  });
});
