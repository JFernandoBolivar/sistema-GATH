import { describe, expect, it } from "vitest";
import { construirBarraAcciones } from "./barra-acciones";
import type { AccionExpediente } from "./expediente";

const base: AccionExpediente = {
  destino: "EN_PRESUPUESTO",
  etiqueta: "Abrir hacia Presupuesto",
  requiereMotivo: false,
  requierePropuesta: true,
  bloqueada: false,
  motivoBloqueo: "",
  sugerida: false,
};

describe("barra de acciones desde acciones[]", () => {
  it("conserva el orden y las etiquetas del servidor", () => {
    const items = construirBarraAcciones([
      { ...base, destino: "EN_CORRECCION_DATOS", etiqueta: "Devolver con observaciones", requiereMotivo: true, requierePropuesta: false },
      base,
    ]);
    expect(items.map((i) => i.etiqueta)).toEqual(["Devolver con observaciones", "Abrir hacia Presupuesto"]);
  });

  it("una acción bloqueada queda deshabilitada y conserva su motivo", () => {
    const [item] = construirBarraAcciones([{ ...base, bloqueada: true, motivoBloqueo: "Falta el resultado psicofísico." }]);
    expect(item.deshabilitada).toBe(true);
    expect(item.motivoBloqueo).toBe("Falta el resultado psicofísico.");
  });

  it("una acción libre no arrastra motivo de bloqueo", () => {
    const [item] = construirBarraAcciones([{ ...base, motivoBloqueo: "texto residual" }]);
    expect(item.deshabilitada).toBe(false);
    expect(item.motivoBloqueo).toBe("");
  });

  it("destaca la sugerida", () => {
    const items = construirBarraAcciones([{ ...base, sugerida: false }, { ...base, destino: "RECHAZADO_CAPTACION", etiqueta: "Rechazar", requiereMotivo: true, requierePropuesta: false, sugerida: true }]);
    expect(items.map((i) => i.destacada)).toEqual([false, true]);
  });

  it("el modo sale de requiere_propuesta / requiere_motivo", () => {
    const items = construirBarraAcciones([
      base,
      { ...base, destino: "EN_CORRECCION_DATOS", requierePropuesta: false, requiereMotivo: true },
      { ...base, destino: "LISTO_PARA_ASIGNAR", requierePropuesta: false },
    ]);
    expect(items.map((i) => i.modo)).toEqual(["propuesta", "motivo", "directa"]);
  });

  it("sin acciones devuelve una lista vacía", () => {
    expect(construirBarraAcciones([])).toEqual([]);
  });
});
