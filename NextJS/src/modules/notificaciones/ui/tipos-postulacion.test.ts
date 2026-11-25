import { describe, expect, it } from "vitest";
import { esTipoCritico, TIPOS_NOTIFICACION, TIPOS_POR_MODULO } from "./tipos-notificacion";

describe("tipos de notificación del módulo postulación", () => {
  it("tiene los tipos del flujo de ingreso con etiqueta en español", () => {
    expect(TIPOS_POR_MODULO.postulacion).toEqual([
      { codigo: "EXPEDIENTE_RECIBIDO", etiqueta: "Expediente recibido" },
      { codigo: "EXPEDIENTE_REVISION_FINAL", etiqueta: "Expediente en revisión final" },
      { codigo: "EXPEDIENTE_EN_PRESUPUESTO", etiqueta: "Expediente en Presupuesto" },
      { codigo: "EXPEDIENTE_EN_DIRECCION", etiqueta: "Ingreso por decidir en Dirección General" },
      { codigo: "EXPEDIENTE_CORRECCION_CARGO", etiqueta: "Cargo por corregir" },
      { codigo: "INGRESO_APROBADO", etiqueta: "Ingreso aprobado" },
      { codigo: "CONTACTAR_POSTULANTE", etiqueta: "Postulante por contactar" },
      { codigo: "CONTACTO_ATRASADO", etiqueta: "Contacto con el postulante atrasado" },
      { codigo: "EXPEDIENTE_EXPIRADO", etiqueta: "Ventana 2 vencida" },
      { codigo: "CONTRATACION_COMPLETADA", etiqueta: "Contratación completada" },
    ]);
  });

  it("se incluyen en la bandeja única del usuario", () => {
    const codigos = TIPOS_NOTIFICACION.map((t) => t.codigo);
    expect(codigos).toEqual(expect.arrayContaining(["EXPEDIENTE_RECIBIDO", "EXPEDIENTE_REVISION_FINAL", "EXPEDIENTE_EN_PRESUPUESTO", "EXPEDIENTE_EN_DIRECCION", "EXPEDIENTE_CORRECCION_CARGO", "INGRESO_APROBADO", "CONTACTAR_POSTULANTE", "CONTACTO_ATRASADO", "EXPEDIENTE_EXPIRADO", "CONTRATACION_COMPLETADA", "CARNET_PENDIENTE"]));
  });

  it("destaca como urgentes solo los avisos de contacto", () => {
    expect(esTipoCritico("CONTACTAR_POSTULANTE")).toBe(true);
    expect(esTipoCritico("CONTACTO_ATRASADO")).toBe(true);
    expect(esTipoCritico("CONTRATACION_COMPLETADA")).toBe(false);
  });

  it("CARNET_PENDIENTE está en la bandeja de carnetización", () => {
    expect(TIPOS_POR_MODULO.carnetizacion).toContainEqual({ codigo: "CARNET_PENDIENTE", etiqueta: "Carnet por emitir" });
  });

  it("CORREO_INSTITUCIONAL_PENDIENTE está en la bandeja de personal con etiqueta en español", () => {
    expect(TIPOS_POR_MODULO.personal).toContainEqual({ codigo: "CORREO_INSTITUCIONAL_PENDIENTE", etiqueta: "Correo institucional por gestionar" });
    expect(TIPOS_NOTIFICACION.map((t) => t.codigo)).toContain("CORREO_INSTITUCIONAL_PENDIENTE");
  });
});
