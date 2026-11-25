import { describe, expect, it } from "vitest";
import { construirBarraAcciones } from "./barra-acciones";
import type { AccionExpediente } from "./expediente";
import { esFlujoCorto, muestraPasoAPaso, pasosIngresoCorto, validarAprobacion, validarPdfFirmado, type PuntoCuentaCaptacion } from "./ingreso-corto";

const reserva = { id: "r", puestoId: 1, estado: "ACTIVA", reservadoPor: "x", reservadoEl: null, venceEl: null, vigente: true, puesto: null };
const pc: PuntoCuentaCaptacion = {
  id: "p", numero: "PC-1", estado: "EMITIDO", referenciaConstancia: "", emitidoPor: "", emitidoEl: null, decididoPor: "", decididoEl: null,
  tieneDocumento: true, puestoId: 1, aprobadoFueraSistema: false, fechaFirma: null, registradoPorNombre: "", tienePdfFirmado: false, pdfFirmadoTamano: null,
};
const sinSin = { requierePresupuesto: false, requiereDireccionGeneral: false };

describe("flujo corto", () => {
  it("solo aplica si falta Presupuesto o Dirección General", () => {
    expect(esFlujoCorto({ requierePresupuesto: true, requiereDireccionGeneral: true })).toBe(false);
    expect(esFlujoCorto(sinSin)).toBe(true);
    expect(muestraPasoAPaso(sinSin, "EN_CAPTURA")).toBe(false);
    expect(muestraPasoAPaso(sinSin, "ENVIADO_CAPTACION")).toBe(true);
  });

  it("pasos sin Presupuesto ni DG según el avance", () => {
    const base = { flujo: sinSin, estado: "ENVIADO_CAPTACION", reserva: null, puntoCuenta: null, acciones: [] as AccionExpediente[] };
    expect(pasosIngresoCorto(base).map((p) => p.estado)).toEqual(["pendiente", "bloqueado", "bloqueado"]);
    expect(pasosIngresoCorto({ ...base, reserva }).map((p) => p.estado)).toEqual(["hecho", "pendiente", "bloqueado"]);
    expect(pasosIngresoCorto({ ...base, reserva, puntoCuenta: pc }).map((p) => p.estado)).toEqual(["hecho", "hecho", "pendiente"]);
    const aprobado = pasosIngresoCorto({ ...base, estado: "APROBADO", reserva, puntoCuenta: { ...pc, aprobadoFueraSistema: true, fechaFirma: "2026-11-20" } });
    expect(aprobado[2].estado).toBe("hecho");
    expect(aprobado[2].descripcion).toBe("Aprobado fuera del sistema · firma del 20/11/2026");
  });

  it("sin Presupuesto y con DG el tercer paso espera a Dirección General", () => {
    const pasos = pasosIngresoCorto({ flujo: { requierePresupuesto: false, requiereDireccionGeneral: true }, estado: "EN_DIRECCION_GENERAL", reserva, puntoCuenta: pc, acciones: [] });
    expect(pasos[2].id).toBe("direccion");
    expect(pasos[2].estado).toBe("pendiente");
  });

  it("con Presupuesto y sin DG hay dos pasos", () => {
    const pasos = pasosIngresoCorto({ flujo: { requierePresupuesto: true, requiereDireccionGeneral: false }, estado: "EN_DIRECCION_GENERAL", reserva: null, puntoCuenta: pc, acciones: [] });
    expect(pasos.map((p) => p.id)).toEqual(["presupuesto", "aprobacion"]);
  });
});

describe("aprobación: validaciones", () => {
  const pdf = (n: string, t: string, size = 10) => new File([new Uint8Array(size)], n, { type: t });
  it("fecha obligatoria y no futura", () => {
    expect(validarAprobacion({ fechaFirma: "", pdfFirmado: null }, "2026-11-24").fechaFirma).toMatch(/Indique/);
    expect(validarAprobacion({ fechaFirma: "2026-11-25", pdfFirmado: null }, "2026-11-24").fechaFirma).toMatch(/futura/);
    expect(validarAprobacion({ fechaFirma: "2026-11-24", pdfFirmado: null }, "2026-11-24")).toEqual({});
  });
  it("PDF opcional con validación de tipo, vacío y tamaño", () => {
    expect(validarPdfFirmado(null)).toBeNull();
    expect(validarPdfFirmado(pdf("a.txt", "text/plain"))).toMatch(/PDF/);
    expect(validarPdfFirmado(pdf("a.pdf", "application/pdf", 0))).toMatch(/vacío/);
    expect(validarPdfFirmado(pdf("a.pdf", "application/pdf"))).toBeNull();
  });
});

describe("barra de acciones por código", () => {
  const a = (codigo: string, extra: Partial<AccionExpediente> = {}): AccionExpediente => ({
    destino: "", etiqueta: codigo, requiereMotivo: false, requierePropuesta: false, bloqueada: false, motivoBloqueo: "", sugerida: false, codigo, ...extra,
  });
  it("asigna el modo por código y claves únicas aunque el destino venga vacío", () => {
    const items = construirBarraAcciones([a("reservar_puesto"), a("liberar_reserva"), a("generar_punto_cuenta"), a("registrar_aprobacion", { requiereFecha: true })]);
    expect(items.map((i) => i.modo)).toEqual(["reservar", "liberar", "generar_punto_cuenta", "aprobacion"]);
    expect(new Set(items.map((i) => i.clave)).size).toBe(4);
    expect(items[0].variante).toBe("secundaria");
  });
  it("reservar es principal mientras generar esté bloqueado", () => {
    const items = construirBarraAcciones([a("reservar_puesto"), a("generar_punto_cuenta", { bloqueada: true, motivoBloqueo: "x" })]);
    expect(items[0].variante).toBe("primaria");
  });
});
