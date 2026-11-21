import { describe, expect, it } from "vitest";
import { describirEstado, estadosDePestana, PESTANAS } from "./expediente";

const TODOS_LOS_ESTADOS = [
  "PRE_REGISTRADO", "EN_CAPTURA", "ENVIADO_CAPTACION", "EN_CORRECCION_DATOS", "RECHAZADO_CAPTACION",
  "EN_PRESUPUESTO", "EN_CORRECCION_CARGO", "DIFERIDO_PRESUPUESTO", "EN_DIRECCION_GENERAL", "RECHAZADO_DIRECCION",
  "APROBADO", "CONSOLIDANDO", "EN_REVISION_FINAL", "LISTO_PARA_ASIGNAR", "CONTRATADO", "EXPIRADO", "DESISTIDO",
];

describe("estados de Captación en lenguaje claro", () => {
  it("cada estado del backend tiene etiqueta en español distinta del código", () => {
    for (const estado of TODOS_LOS_ESTADOS) {
      const d = describirEstado(estado);
      expect(d.etiqueta, estado).not.toBe(estado);
      expect(d.etiqueta).not.toMatch(/_/);
    }
  });

  it("mapea los estados clave con su tono", () => {
    expect(describirEstado("ENVIADO_CAPTACION")).toEqual({ etiqueta: "Por revisar", tono: "warning" });
    expect(describirEstado("EN_CORRECCION_DATOS").etiqueta).toBe("Devuelto al postulante");
    expect(describirEstado("EN_PRESUPUESTO").etiqueta).toBe("En Presupuesto");
    expect(describirEstado("RECHAZADO_CAPTACION").tono).toBe("danger");
    expect(describirEstado("CONTRATADO").tono).toBe("success");
  });

  it("un estado desconocido se muestra tal cual y en tono neutro", () => {
    expect(describirEstado("NUEVO_ESTADO")).toEqual({ etiqueta: "NUEVO_ESTADO", tono: "neutral" });
  });
});

describe("pestañas de la bandeja", () => {
  it("son Por revisar, En corrección, En Presupuesto y Todos", () => {
    expect(PESTANAS.map((p) => p.etiqueta)).toEqual(["Por revisar", "En corrección", "En Presupuesto", "Todos"]);
  });

  it("«Por revisar» agrupa lo que espera a Captación y «Todos» no filtra", () => {
    expect(estadosDePestana("por_revisar")).toEqual(["ENVIADO_CAPTACION", "EN_REVISION_FINAL"]);
    expect(estadosDePestana("en_correccion")).toContain("EN_CORRECCION_DATOS");
    expect(estadosDePestana("todos")).toEqual([]);
  });
});
