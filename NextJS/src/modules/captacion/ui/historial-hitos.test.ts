import { describe, expect, it } from "vitest";
import { camposDeVentana1 } from "../domain/datos-ventana1";
import { hitosDeHistorial } from "./historial-hitos";

describe("historial como línea de tiempo", () => {
  it("marca el último como actual, los anteriores como hechos y los rechazos como no aprobados", () => {
    const hitos = hitosDeHistorial([
      { estadoOrigen: null, estadoDestino: "PRE_REGISTRADO", fecha: "2026-11-01T10:00:00Z", actorCedula: "123", actorTipo: "USUARIO", motivo: "" },
      { estadoOrigen: "ENVIADO_CAPTACION", estadoDestino: "EN_CORRECCION_DATOS", fecha: "2026-11-02T10:00:00Z", actorCedula: "123", actorTipo: "USUARIO", motivo: "Falta la dirección" },
      { estadoOrigen: "ENVIADO_CAPTACION", estadoDestino: "RECHAZADO_CAPTACION", fecha: "2026-11-03T10:00:00Z", actorCedula: "", actorTipo: "SISTEMA", motivo: "" },
    ]);
    expect(hitos.map((h) => h.estado)).toEqual(["hecho", "hecho", "fallido"]);
    expect(hitos[1].detalle).toContain("Motivo: Falta la dirección");
    expect(hitos[2].detalle).toBe("Sistema");
  });
});

describe("asientos del enlace de activación", () => {
  it("se titulan con el correo enmascarado y no desplazan el paso actual", () => {
    const hitos = hitosDeHistorial([
      { estadoOrigen: null, estadoDestino: "PRE_REGISTRADO", fecha: "2026-11-01T10:00:00Z", actorCedula: "123", actorTipo: "USUARIO", motivo: "" },
      { estadoOrigen: "PRE_REGISTRADO", estadoDestino: "PRE_REGISTRADO", fecha: "2026-11-01T10:00:01Z", actorCedula: "123", actorTipo: "USUARIO", motivo: "", tipo: "ENLACE_ACTIVACION_ENVIADO", correoEnmascarado: "ju***@gmail.com" },
      { estadoOrigen: "PRE_REGISTRADO", estadoDestino: "PRE_REGISTRADO", fecha: "2026-11-02T10:00:00Z", actorCedula: "999", actorTipo: "POSTULANTE", motivo: "", tipo: "ENLACE_ACTIVACION_USADO" },
    ]);
    expect(hitos[1].titulo).toBe("Enlace de acceso enviado a ju***@gmail.com");
    expect(hitos[2].titulo).toMatch(/creó su contraseña/);
    expect(hitos.map((h) => h.estado)).toEqual(["actual", "hecho", "hecho"]);
  });
});

describe("datos de la Ventana 1 legibles", () => {
  it("traduce sexo y nacionalidad y marca lo vacío como «No informado»", () => {
    const campos = camposDeVentana1({ sexo: "F", nacionalidad: "V", contacto_emergencia: { nombre: "Ana", telefono: "0412", parentesco: "Madre" } });
    const por = Object.fromEntries(campos.map((c) => [c.etiqueta, c.valor]));
    expect(por["Sexo"]).toBe("Femenino");
    expect(por["Nacionalidad"]).toBe("Venezolano(a)");
    expect(por["Estado civil"]).toBe("No informado");
    expect(por["Contacto de emergencia"]).toBe("Ana (Madre) 0412");
  });
});
