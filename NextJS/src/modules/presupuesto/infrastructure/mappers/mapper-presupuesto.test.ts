import { describe, expect, it } from "vitest";
import { detalleAreaDesdeApi, paginaAreaDesdeApi, paginaVacantesDesdeApi } from "./mapper-presupuesto";

describe("mapper de Presupuesto", () => {
  it("mapea el detalle con reserva, constancia, Punto de Cuenta, documentos y acciones", () => {
    const d = detalleAreaDesdeApi({
      expediente: { id: "e1", numero: "EXP-1", estado: "EN_PRESUPUESTO", propuesta: { cargo_id: 3, nombres: { cargo: "Analista" }, cargo_texto: "" } },
      postulante: { id: "p1", cedula: "123", nombres: "Ana", apellidos: "Pérez" },
      reserva: { id: "r1", puesto_id: 7, estado: "ACTIVA", vigente: true, vence_el: "2026-12-01T00:00:00Z", puesto: { id: 7, codigo: "P-7", cargo: { id: 3, nombre: "Analista" } } },
      constancia: { referencia: "OF-1", tiene_adjunto: true, adjunto_tamano: 2048 },
      punto_cuenta: { id: "pc", numero: "PC-1", estado: "EMITIDO", tiene_documento: true },
      documentos: { punto_cuenta: "/x/punto-cuenta/", constancia_adjunto: null },
      historial: [{ estado_destino: "EN_PRESUPUESTO", fecha: "2026-11-01T00:00:00Z", motivo: "" }],
      acciones: [{ destino: "EN_DIRECCION_GENERAL", etiqueta: "Emitir", requiere_motivo: false, bloqueada: true, motivo_bloqueo: "Falta la reserva" }],
      capacidades: { puede_reservar: true, puede_declarar_disponibilidad: false },
    });
    expect(d.expediente.propuesta.nombres.cargo).toBe("Analista");
    expect(d.reserva?.puesto?.codigo).toBe("P-7");
    expect(d.reserva?.vigente).toBe(true);
    expect(d.constancia?.adjuntoTamano).toBe(2048);
    expect(d.puntoCuenta?.tieneDocumento).toBe(true);
    expect(d.documentos).toEqual({ puntoCuenta: "/x/punto-cuenta/", constanciaAdjunto: null });
    expect(d.acciones[0]).toMatchObject({ bloqueada: true, motivoBloqueo: "Falta la reserva", requierePropuesta: false, sugerida: false });
    expect(d.capacidades).toEqual({ puedeReservar: true, puedeDeclararDisponibilidad: false });
  });

  it("tolera un detalle sin reserva, constancia ni Punto de Cuenta", () => {
    const d = detalleAreaDesdeApi({ expediente: {}, postulante: {}, reserva: null, constancia: null, punto_cuenta: null });
    expect(d.reserva).toBeNull();
    expect(d.constancia).toBeNull();
    expect(d.puntoCuenta).toBeNull();
    expect(d.acciones).toEqual([]);
  });

  it("mapea la bandeja con la reserva, la constancia y el Punto de Cuenta de cada fila", () => {
    const p = paginaAreaDesdeApi({
      resultados: [{ id: "e1", numero: "EXP-1", estado: "EN_PRESUPUESTO", pendiente: true, postulante: { cedula: "1", nombres: "A", apellidos: "B" }, propuesta: { cargo_texto: "Analista", oficina_texto: "Sistemas" }, reserva: { puesto_id: 7, vence_el: "x" }, tiene_constancia: true, punto_cuenta: { numero: "PC-1", estado: "EMITIDO" } }],
      total: 1, pagina: 1, tamano: 10, total_paginas: 1,
    });
    expect(p.resultados[0]).toMatchObject({ pendiente: true, cargoTexto: "Analista", reservaPuestoId: 7, tieneConstancia: true, puntoCuentaNumero: "PC-1" });
  });

  it("mapea las vacantes con la reserva propia", () => {
    const v = paginaVacantesDesdeApi({
      resultados: [{ id: 7, codigo: "P-7", reserva_propia: true, cargo: { id: 1, nombre: "A" } }],
      total: 1, pagina: 1, tamano: 6, total_paginas: 1, filtros: { de_propuesta: true }, reserva: null,
    });
    expect(v.resultados[0]).toMatchObject({ id: 7, codigo: "P-7", reservaPropia: true });
    expect(v.deLaPropuesta).toBe(true);
  });
});
