import { describe, expect, it } from "vitest";

import { PERMISO_MOVIMIENTOS } from "../../domain/value-objects/permisos-movimientos";
import {
  puedeExportarMovimientosExcel,
  puedeExportarMovimientosPdf,
  puedeVerMovimientos,
} from "./permisos-movimiento";

/**
 * G12-3: los botones PDF y Excel se muestran solo con su permiso
 * (`movimientos.exportar_pdf` / `movimientos.exportar_excel`), por código y no
 * por nombre de rol. El seed entrega códigos enumerados: no hay "*".
 */
const CONSULTA = ["movimientos.ver"];
const CON_PDF = [...CONSULTA, PERMISO_MOVIMIENTOS.exportarPdf];
const CON_EXCEL = [...CONSULTA, PERMISO_MOVIMIENTOS.exportarExcel];
const COMPLETO = [...CONSULTA, PERMISO_MOVIMIENTOS.exportarPdf, PERMISO_MOVIMIENTOS.exportarExcel];

describe("permisos del historial de movimientos", () => {
  it("consultar exige movimientos.ver y no se deduce de exportar", () => {
    expect(puedeVerMovimientos(CONSULTA)).toBe(true);
    expect(puedeVerMovimientos(CON_PDF)).toBe(true);
    expect(puedeVerMovimientos([])).toBe(false);
    expect(puedeVerMovimientos(null)).toBe(false);
  });

  it("cada botón de exportación exige su propio código", () => {
    expect(puedeExportarMovimientosPdf(CON_PDF)).toBe(true);
    expect(puedeExportarMovimientosPdf(CON_EXCEL)).toBe(false);
    expect(puedeExportarMovimientosExcel(CON_EXCEL)).toBe(true);
    expect(puedeExportarMovimientosExcel(CON_PDF)).toBe(false);
    expect(puedeExportarMovimientosPdf(COMPLETO)).toBe(true);
    expect(puedeExportarMovimientosExcel(COMPLETO)).toBe(true);
  });

  it("no concede nada a una sesión sin permisos ni a un código de otro módulo", () => {
    expect(puedeVerMovimientos(undefined)).toBe(false);
    expect(puedeExportarMovimientosPdf(["personal.exportar_pdf"])).toBe(false);
    expect(puedeExportarMovimientosExcel(["reportes.generar_excel"])).toBe(false);
  });
});
