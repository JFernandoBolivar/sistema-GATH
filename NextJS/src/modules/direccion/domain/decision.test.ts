import { describe, expect, it } from "vitest";
import type { AccionExpediente } from "@/modules/presupuesto/domain/solicitud";
import { panelDecision } from "./decision";
import { PESTANAS_DIRECCION } from "./ingreso";

const accion = (destino: string, etiqueta: string, extra: Partial<AccionExpediente> = {}): AccionExpediente => ({
  destino, etiqueta, requiereMotivo: false, requierePropuesta: false, bloqueada: false, motivoBloqueo: "", sugerida: false, ...extra,
});

describe("decisión de Dirección General", () => {
  it("separa aprobar (directa) y rechazar (con motivo, peligro) desde acciones[]", () => {
    const { aprobar, rechazar } = panelDecision([
      accion("APROBADO", "Aprobar el ingreso"),
      accion("RECHAZADO_DIRECCION", "Rechazar el ingreso", { requiereMotivo: true }),
    ]);
    expect(aprobar).toMatchObject({ modo: "directa", variante: "primaria", etiqueta: "Aprobar el ingreso" });
    expect(rechazar).toMatchObject({ modo: "motivo", variante: "peligro" });
  });

  it("sin acciones del servidor no hay decisión", () => {
    expect(panelDecision([])).toEqual({ aprobar: null, rechazar: null });
  });

  it("respeta la acción bloqueada con su motivo", () => {
    const { aprobar } = panelDecision([accion("APROBADO", "Aprobar el ingreso", { bloqueada: true, motivoBloqueo: "Sin permiso" })]);
    expect(aprobar).toMatchObject({ deshabilitada: true, motivoBloqueo: "Sin permiso" });
  });

  it("las pestañas son Pendientes e Histórico, por vista", () => {
    expect(PESTANAS_DIRECCION.map((p) => [p.etiqueta, p.vista])).toEqual([["Pendientes", "pendientes"], ["Histórico", "historico"]]);
  });
});
