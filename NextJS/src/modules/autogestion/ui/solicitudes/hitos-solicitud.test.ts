import { describe, expect, it } from "vitest";
import { solicitudFake } from "../../domain/services/fixtures-solicitud";
import { PRESENTACION_ESTADO } from "../estado-solicitud-ui";
import { ESTADOS_SOLICITUD } from "../../domain/entities/solicitud-actualizacion";
import { formatearValor } from "../formato-solicitud";
import { hitosSolicitud } from "./hitos-solicitud";

const estados = (s: Parameters<typeof hitosSolicitud>[0]) =>
  hitosSolicitud(s).map((h) => `${h.id}:${h.estado}`);

describe("hitosSolicitud", () => {
  it("SOLICITADA: el primer hito es el paso actual", () => {
    expect(estados(solicitudFake())).toEqual([
      "solicitada:actual",
      "habilitada:pendiente",
      "enviada:pendiente",
      "resolucion:pendiente",
    ]);
  });
  it("HABILITADA y ENVIADA avanzan el paso actual", () => {
    const hab = solicitudFake({
      estado: "HABILITADA",
      ventanaInicio: "2026-10-02T00:00:00Z",
      ventanaFin: "2026-10-20T00:00:00Z",
    });
    expect(estados(hab)).toEqual([
      "solicitada:hecho",
      "habilitada:actual",
      "enviada:pendiente",
      "resolucion:pendiente",
    ]);
    const env = { ...hab, estado: "ENVIADA" as const, fechaEnvio: "2026-10-05T00:00:00Z" };
    expect(estados(env)).toEqual([
      "solicitada:hecho",
      "habilitada:hecho",
      "enviada:actual",
      "resolucion:pendiente",
    ]);
  });
  it("DEVUELTA: el paso actual es el envío y muestra el motivo de la devolución", () => {
    const dev = solicitudFake({
      estado: "DEVUELTA",
      ventanaInicio: "2026-10-02T00:00:00Z",
      ventanaFin: "2026-10-20T00:00:00Z",
      fechaEnvio: "2026-10-05T00:00:00Z",
      motivoDevolucion: "Falta la constancia",
      fechaDevolucion: "2026-10-06T00:00:00Z",
    });
    expect(estados(dev)).toEqual([
      "solicitada:hecho",
      "habilitada:hecho",
      "enviada:actual",
      "resolucion:pendiente",
    ]);
    expect(hitosSolicitud(dev)[2].detalle).toContain("Falta la constancia");
  });
  it("APROBADA completa todo; RECHAZADA temprana se resume en dos hitos", () => {
    const aprobada = solicitudFake({
      estado: "APROBADA",
      ventanaInicio: "2026-10-02T00:00:00Z",
      fechaEnvio: "2026-10-05T00:00:00Z",
      fechaDecision: "2026-10-06T00:00:00Z",
    });
    expect(estados(aprobada).every((e) => e.endsWith(":hecho"))).toBe(true);
    const rechazada = solicitudFake({
      estado: "RECHAZADA",
      motivoDecision: "No procede",
      fechaDecision: "2026-10-03T00:00:00Z",
    });
    expect(estados(rechazada)).toEqual(["solicitada:hecho", "resolucion:fallido"]);
  });
  it("EXPIRADA marca la ventana como no completada", () => {
    const exp = solicitudFake({
      estado: "EXPIRADA",
      ventanaInicio: "2026-10-02T00:00:00Z",
      ventanaFin: "2026-10-09T00:00:00Z",
    });
    expect(estados(exp)).toEqual(["solicitada:hecho", "habilitada:hecho"]);
  });
});

describe("presentación de estados", () => {
  it("todo estado del backend tiene texto en español, tono e ícono", () => {
    for (const e of ESTADOS_SOLICITUD) {
      expect(PRESENTACION_ESTADO[e].texto.length).toBeGreaterThan(0);
      expect(PRESENTACION_ESTADO[e].ayuda.length).toBeGreaterThan(0);
    }
    expect(PRESENTACION_ESTADO.APROBADA_PARCIAL.texto).toBe("Aprobada en parte");
    expect(PRESENTACION_ESTADO.EXPIRADA.texto).toBe("Vencida");
  });
});

describe("formatearValor", () => {
  it("formatea booleanos, nulos y nombres de catálogo", () => {
    expect(formatearValor(true, "tiene_hijos")).toBe("Sí");
    expect(formatearValor(null, "telefono_movil")).toBe("Sin dato");
    expect(formatearValor(5, "estado_id", { estados: { 5: "Miranda" } })).toBe("Miranda");
    expect(formatearValor(5, "estado_id")).toBe("Código 5");
    expect(
      formatearValor({ primer_nombre: "Ana", parentesco_id: 2 }, "*", {
        parentescos: { 2: "Hija" },
      }),
    ).toBe("Ana · Hija");
  });
});
