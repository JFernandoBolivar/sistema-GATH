import { describe, expect, it } from "vitest";

import { etapasExpediente } from "./etapas-expediente";

const COMPLETO = { requierePresupuesto: true, requiereDireccionGeneral: true };
const CORTO = { requierePresupuesto: false, requiereDireccionGeneral: false };

const estados = (etapas: ReturnType<typeof etapasExpediente>) => etapas.map((e) => e.estado);

describe("etapas del expediente", () => {
  it("marca las etapas anteriores como hechas, la actual como en curso y las siguientes como pendientes", () => {
    const etapas = etapasExpediente({ estado: "CONSOLIDANDO", flujo: COMPLETO });
    expect(etapas.map((e) => e.id)).toEqual([
      "datos",
      "revision",
      "presupuesto",
      "direccion",
      "complementarios",
      "revision_final",
      "contratacion",
    ]);
    expect(estados(etapas)).toEqual([
      "hecho",
      "hecho",
      "hecho",
      "hecho",
      "actual",
      "pendiente",
      "pendiente",
    ]);
    expect(etapas[4].descripcion).toMatch(/Ventana 2/);
  });

  it("muestra «fuera del sistema» las etapas desactivadas, aunque el estado sea anterior", () => {
    const etapas = etapasExpediente({ estado: "ENVIADO_CAPTACION", flujo: CORTO });
    expect(etapas[2]).toMatchObject({ titulo: "Presupuesto", estado: "fuera_sistema" });
    expect(etapas[3]).toMatchObject({ titulo: "Dirección General", estado: "fuera_sistema" });
    expect(etapas[2].descripcion).toMatch(/fuera del sistema/);
    expect(etapas[1].estado).toBe("actual");
  });

  it("una etapa desactivada sigue fuera del sistema aunque el expediente haya avanzado", () => {
    const etapas = etapasExpediente({ estado: "APROBADO", flujo: { requierePresupuesto: false, requiereDireccionGeneral: true } });
    expect(etapas[2].estado).toBe("fuera_sistema");
    expect(etapas[3].estado).toBe("hecho");
  });

  it("ubica un expediente expirado en la etapa donde se cerró usando el historial", () => {
    const etapas = etapasExpediente({
      estado: "EXPIRADO",
      flujo: COMPLETO,
      historial: [
        { estadoOrigen: "APROBADO", estadoDestino: "CONSOLIDANDO" },
        { estadoOrigen: "CONSOLIDANDO", estadoDestino: "EXPIRADO" },
      ],
    });
    expect(etapas[4].estado).toBe("actual");
    expect(etapas[4].descripcion).toMatch(/venció/);
    expect(etapas[3].estado).toBe("hecho");
    expect(etapas[5].estado).toBe("pendiente");
  });

  it("sin historial, un expirado de Ventana 2 se ubica en Datos complementarios y uno de Ventana 1 en Datos iniciales", () => {
    expect(etapasExpediente({ estado: "EXPIRADO", flujo: COMPLETO, ventana: 2 })[4].estado).toBe("actual");
    expect(etapasExpediente({ estado: "EXPIRADO", flujo: COMPLETO, ventana: 1 })[0].estado).toBe("actual");
  });

  it("marca un rechazo o una contratación en su etapa", () => {
    expect(etapasExpediente({ estado: "RECHAZADO_CAPTACION", flujo: COMPLETO })[1].estado).toBe("actual");
    expect(etapasExpediente({ estado: "RECHAZADO_DIRECCION", flujo: COMPLETO })[3].estado).toBe("actual");
    const contratado = etapasExpediente({ estado: "CONTRATADO", flujo: COMPLETO });
    expect(contratado[6].estado).toBe("actual");
    expect(contratado.slice(0, 6).every((e) => e.estado === "hecho")).toBe(true);
  });
});
