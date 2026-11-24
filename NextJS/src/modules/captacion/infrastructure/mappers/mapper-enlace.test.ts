import { describe, expect, it } from "vitest";
import { credencialDesdeApi, detalleDesdeApi, enlaceActivacionDesdeApi, envioEnlaceDesdeApi } from "./mapper-captacion";

describe("mapeo del enlace de activación", () => {
  it("la credencial por correo no trae contraseña y sí el correo enmascarado", () => {
    const c = credencialDesdeApi({ usuario: "123", ventana: 1, vence_el: "2026-12-01T00:00:00Z", debe_cambiar_clave: true, enlace: { enviado_a: "ju***@gmail.com", vence_el: "2026-11-26T00:00:00Z" } });
    expect(c.claveTemporal).toBe("");
    expect(c.enlace).toEqual({ enviadoA: "ju***@gmail.com", venceEl: "2026-11-26T00:00:00Z" });
  });

  it("la credencial en persona no tiene enlace", () => {
    expect(credencialDesdeApi({ usuario: "123", clave_temporal: "Abc12345xyz" }).enlace).toBeNull();
  });

  it("la respuesta de enviar-enlace se presenta como credencial sin clave", () => {
    const c = envioEnlaceDesdeApi({ enviado_a: "ju***@gmail.com", vence_el: "2026-11-26T00:00:00Z" });
    expect(c).toMatchObject({ claveTemporal: "", enlace: { enviadoA: "ju***@gmail.com" } });
  });

  it("el último enlace del detalle solo admite estados conocidos", () => {
    expect(enlaceActivacionDesdeApi(null)).toBeNull();
    expect(enlaceActivacionDesdeApi({ estado: "RARO" })).toBeNull();
    expect(enlaceActivacionDesdeApi({ estado: "PENDIENTE", enviado_a: "ju***@x.com", vence_el: "2026-11-26T00:00:00Z" })).toMatchObject({ estado: "PENDIENTE", enviadoA: "ju***@x.com" });
    expect(detalleDesdeApi({ expediente: {}, postulante: {}, enlace_activacion: { estado: "USADO", enviado_a: "a***@x.com" }, historial: [{ tipo: "ENLACE_ACTIVACION_ENVIADO", correo_enmascarado: "a***@x.com", estado_destino: "PRE_REGISTRADO" }] }).historial[0]).toMatchObject({ tipo: "ENLACE_ACTIVACION_ENVIADO", correoEnmascarado: "a***@x.com" });
  });
});
