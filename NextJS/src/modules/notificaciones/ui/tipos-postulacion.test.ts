import { describe, expect, it } from "vitest";
import { TIPOS_NOTIFICACION, TIPOS_POR_MODULO } from "./tipos-notificacion";

describe("tipos de notificación del módulo postulación", () => {
  it("tiene los tipos del flujo de ingreso con etiqueta en español", () => {
    expect(TIPOS_POR_MODULO.postulacion).toEqual([
      { codigo: "EXPEDIENTE_RECIBIDO", etiqueta: "Expediente recibido" },
      { codigo: "EXPEDIENTE_REVISION_FINAL", etiqueta: "Expediente en revisión final" },
      { codigo: "EXPEDIENTE_EN_PRESUPUESTO", etiqueta: "Expediente en Presupuesto" },
      { codigo: "EXPEDIENTE_EN_DIRECCION", etiqueta: "Ingreso por decidir en Dirección General" },
      { codigo: "EXPEDIENTE_CORRECCION_CARGO", etiqueta: "Cargo por corregir" },
      { codigo: "INGRESO_APROBADO", etiqueta: "Ingreso aprobado" },
    ]);
  });

  it("se incluyen en la bandeja única del usuario", () => {
    const codigos = TIPOS_NOTIFICACION.map((t) => t.codigo);
    expect(codigos).toEqual(expect.arrayContaining(["EXPEDIENTE_RECIBIDO", "EXPEDIENTE_REVISION_FINAL", "EXPEDIENTE_EN_PRESUPUESTO", "EXPEDIENTE_EN_DIRECCION", "EXPEDIENTE_CORRECCION_CARGO", "INGRESO_APROBADO"]));
  });
});
