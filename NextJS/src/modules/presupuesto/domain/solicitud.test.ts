import { describe, expect, it } from "vitest";
import { describirEstado } from "@/modules/captacion/domain/expediente";
import {
  describirPuntoCuenta,
  motivoDeEntrada,
  opcionesDeFiltro,
  PESTANAS_PRESUPUESTO,
  pasosGuia,
  validarConstancia,
  cargoPropuesto,
  oficinaPropuesta,
  type Constancia,
  type Puesto,
  type PuntoCuenta,
  type PropuestaConNombres,
  type Reserva,
} from "./solicitud";

const ref = (id: number | null, nombre = "") => ({ id, nombre });
const puesto = (id: number, codigo: string, cargo: [number, string], dep: [number, string]): Puesto => ({
  id, codigo, vacante: true, cargo: ref(...cargo), cargoEspecifico: ref(null), tipoNomina: ref(null),
  dependencia: ref(...dep), direccionGeneral: ref(null), direccionLinea: ref(null), coordinacion: ref(null),
});
const reserva = (estado = "ACTIVA", vigente = true): Reserva => ({
  id: "r1", puestoId: 7, estado, reservadoPor: "Ana", reservadoEl: null, venceEl: null, vigente, puesto: puesto(7, "P-007", [1, "Analista"], [2, "Sistemas"]),
});
const constancia: Constancia = {
  referencia: "OF-1", observaciones: "", fecha: null, declaradoPorCedula: "1", declaradoPorNombre: "Ana",
  tieneAdjunto: false, adjuntoTamano: null,
};
const punto: PuntoCuenta = {
  id: "p1", numero: "PC-2026-0001", estado: "EMITIDO", referenciaConstancia: "OF-1", emitidoPor: "Ana", emitidoEl: null,
  decididoPor: "", decididoEl: null, tieneDocumento: true,
};

describe("guía de pasos de Presupuesto", () => {
  it("sin reserva ni constancia: 1 y 2 pendientes y el 3 en espera, diciendo qué falta", () => {
    const [p1, p2, p3] = pasosGuia({ reserva: null, constancia: null, puntoCuenta: null });
    expect([p1.estado, p2.estado, p3.estado]).toEqual(["pendiente", "pendiente", "bloqueado"]);
    expect(p3.descripcion).toBe("Primero debe reservar el puesto y declarar la disponibilidad");
  });

  it("con reserva: el 1 está hecho y el 3 sigue esperando la constancia", () => {
    const [p1, p2, p3] = pasosGuia({ reserva: reserva(), constancia: null, puntoCuenta: null });
    expect([p1.estado, p2.estado, p3.estado]).toEqual(["hecho", "pendiente", "bloqueado"]);
    expect(p1.descripcion).toContain("P-007");
    expect(p3.descripcion).toBe("Primero debe declarar la disponibilidad");
  });

  it("con reserva y constancia: el 3 queda listo para emitir", () => {
    const [, , p3] = pasosGuia({ reserva: reserva(), constancia, puntoCuenta: null });
    expect(p3.estado).toBe("pendiente");
    expect(p3.descripcion).toMatch(/puede emitirlo/);
  });

  it("con Punto de Cuenta emitido: los tres están hechos", () => {
    expect(pasosGuia({ reserva: reserva(), constancia, puntoCuenta: punto }).map((p) => p.estado)).toEqual(["hecho", "hecho", "hecho"]);
  });

  it("una reserva liberada o vencida no cuenta como hecha", () => {
    expect(pasosGuia({ reserva: reserva("LIBERADA", false), constancia, puntoCuenta: null })[0].estado).toBe("pendiente");
    const vencida = pasosGuia({ reserva: reserva("ACTIVA", false), constancia, puntoCuenta: null });
    expect(vencida[0].estado).toBe("pendiente");
    expect(vencida[0].descripcion).toMatch(/venció/);
    expect(vencida[2].estado).toBe("bloqueado");
  });

  it("numera los pasos del 1 al 3 con sus títulos", () => {
    expect(pasosGuia({ reserva: null, constancia: null, puntoCuenta: null }).map((p) => `${p.numero}. ${p.titulo}`)).toEqual([
      "1. Reservar puesto", "2. Declarar disponibilidad", "3. Emitir Punto de Cuenta",
    ]);
  });
});

describe("mapeo de estados de Presupuesto y Dirección", () => {
  it("cada estado tiene etiqueta en español y tono", () => {
    expect(describirEstado("EN_PRESUPUESTO")).toEqual({ etiqueta: "En Presupuesto", tono: "info" });
    expect(describirEstado("DIFERIDO_PRESUPUESTO").tono).toBe("warning");
    expect(describirEstado("EN_CORRECCION_CARGO").tono).toBe("warning");
    expect(describirEstado("EN_DIRECCION_GENERAL").etiqueta).toBe("En Dirección General");
    expect(describirEstado("APROBADO").tono).toBe("success");
    expect(describirEstado("RECHAZADO_DIRECCION").tono).toBe("danger");
  });

  it("los estados del Punto de Cuenta se leen en lenguaje claro", () => {
    expect(describirPuntoCuenta("EMITIDO").etiqueta).toBe("Emitido, por decidir");
    expect(describirPuntoCuenta("FIRMADO")).toEqual({ etiqueta: "Aprobado y firmado", tono: "success" });
    expect(describirPuntoCuenta("RECHAZADO").tono).toBe("danger");
    expect(describirPuntoCuenta("OTRO")).toEqual({ etiqueta: "OTRO", tono: "neutral" });
  });
});

describe("pestañas de la bandeja de Presupuesto", () => {
  it("son cuatro y filtran por los estados del enunciado", () => {
    expect(PESTANAS_PRESUPUESTO.map((p) => p.etiqueta)).toEqual(["Por atender", "Diferidos", "En corrección de cargo", "Todos"]);
    expect(PESTANAS_PRESUPUESTO.map((p) => p.estados)).toEqual([["EN_PRESUPUESTO"], ["DIFERIDO_PRESUPUESTO"], ["EN_CORRECCION_CARGO"], []]);
    expect(PESTANAS_PRESUPUESTO[3].vista).toBe("todos");
  });
});

describe("validación de la constancia", () => {
  const pdf = (bytes = 1000, nombre = "c.pdf", tipo = "application/pdf") => new File([new Uint8Array(bytes)], nombre, { type: tipo });

  it("la referencia es obligatoria", () => {
    expect(validarConstancia({ referencia: "  ", observaciones: "", adjunto: null }).referencia).toBeDefined();
    expect(validarConstancia({ referencia: "OF-1", observaciones: "", adjunto: null })).toEqual({});
  });

  it("la referencia admite hasta 100 caracteres", () => {
    expect(validarConstancia({ referencia: "x".repeat(101), observaciones: "", adjunto: null }).referencia).toMatch(/100/);
    expect(validarConstancia({ referencia: "x".repeat(100), observaciones: "", adjunto: null })).toEqual({});
  });

  it("el adjunto debe ser PDF", () => {
    const e = validarConstancia({ referencia: "OF-1", observaciones: "", adjunto: pdf(10, "foto.png", "image/png") });
    expect(e.adjunto).toBe("El adjunto debe ser un archivo PDF.");
    expect(validarConstancia({ referencia: "OF-1", observaciones: "", adjunto: pdf(10, "x.PDF", "") })).toEqual({});
  });

  it("el adjunto no pasa de 10 MB", () => {
    const grande = pdf(10 * 1024 * 1024 + 1);
    expect(validarConstancia({ referencia: "OF-1", observaciones: "", adjunto: grande }).adjunto).toBe("El adjunto supera los 10 MB.");
    expect(validarConstancia({ referencia: "OF-1", observaciones: "", adjunto: pdf(10 * 1024 * 1024) })).toEqual({});
  });

  it("rechaza un PDF vacío", () => {
    expect(validarConstancia({ referencia: "OF-1", observaciones: "", adjunto: pdf(0) }).adjunto).toBe("El archivo está vacío.");
  });

  it("limita las observaciones a 2000 caracteres", () => {
    expect(validarConstancia({ referencia: "OF-1", observaciones: "x".repeat(2001), adjunto: null }).observaciones).toBeDefined();
  });
});

describe("utilidades de la solicitud", () => {
  it("el motivo de entrada es el del hito más reciente hacia ese estado", () => {
    const h = (estadoDestino: string, motivo: string) => ({ estadoOrigen: null, estadoDestino, fecha: "", actorCedula: "", actorTipo: "", motivo });
    const hist = [h("EN_CORRECCION_CARGO", "viejo"), h("EN_PRESUPUESTO", ""), h("EN_CORRECCION_CARGO", "nuevo")];
    expect(motivoDeEntrada(hist, "EN_CORRECCION_CARGO")).toBe("nuevo");
    expect(motivoDeEntrada(hist, "APROBADO")).toBe("");
  });

  it("las opciones de filtro salen sin repetir y ordenadas", () => {
    const filas = [
      puesto(1, "A", [2, "Zeta"], [9, "Dep"]),
      puesto(2, "B", [1, "Alfa"], [9, "Dep"]),
      puesto(3, "C", [2, "Zeta"], [9, "Dep"]),
    ];
    expect(opcionesDeFiltro(filas, "cargo")).toEqual([{ id: 1, nombre: "Alfa" }, { id: 2, nombre: "Zeta" }]);
    expect(opcionesDeFiltro(filas, "coordinacion")).toEqual([]);
  });

  it("el cargo y la oficina propuestos prefieren los nombres del catálogo y caen al texto libre", () => {
    const base: PropuestaConNombres = {
      cargoId: null, cargoEspecificoId: null, tipoNominaId: null, direccionGeneralId: null, direccionLineaId: null,
      coordinacionId: null, dependenciaId: null, cargoTexto: "Texto cargo", oficinaTexto: "Texto oficina", nombres: {},
    };
    expect(cargoPropuesto(base)).toBe("Texto cargo");
    expect(oficinaPropuesta(base)).toBe("Texto oficina");
    const conNombres = { ...base, nombres: { cargo: "Analista", direccion_general: "DG", dependencia: "Sistemas" } };
    expect(cargoPropuesto(conNombres)).toBe("Analista");
    expect(oficinaPropuesta(conNombres)).toBe("DG › Sistemas");
    expect(cargoPropuesto({ ...base, cargoTexto: "" })).toBe("Sin cargo propuesto");
  });
});
