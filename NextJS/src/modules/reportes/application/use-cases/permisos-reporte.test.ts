import { describe, expect, it } from "vitest";

import { PERMISO_REPORTES } from "../../domain/value-objects/permisos-reportes";
import {
  puedeFiltrarEstructuraOrganizativa,
  puedeGenerarReportePdf,
  puedeVerReportes,
} from "./permisos-reporte";

/**
 * G1/G2: la visibilidad de los filtros de estructura y la generación del PDF
 * se deciden por códigos del seed, no por el comodín "*" ni por el rol. El rol
 * ADMINISTRADOR recibe la lista enumerada de permisos, así que estas funciones
 * deben funcionar con esa lista.
 */
const ADMINISTRADOR = [
  "personal.ver",
  "organizacion.ver",
  "reportes.ver",
  "reportes.generar_pdf",
  "reportes.generar_excel",
  "reportes.estadisticas",
];

describe("permisos del reporte de trabajador", () => {
  it("reconoce los códigos enumerados de un administrador", () => {
    expect(puedeVerReportes(ADMINISTRADOR)).toBe(true);
    expect(puedeGenerarReportePdf(ADMINISTRADOR)).toBe(true);
    expect(puedeFiltrarEstructuraOrganizativa(ADMINISTRADOR)).toBe(true);
  });

  it("funciona con la lista enumerada del rol ADMINISTRADOR (sin comodín)", () => {
    // Regresión G1: el seed entrega los códigos uno por uno; no hay "*" en la sesión.
    expect(ADMINISTRADOR).not.toContain("*");
    expect(puedeVerReportes(ADMINISTRADOR)).toBe(true);
  });

  it("acepta el patrón de módulo pero no el de otro módulo", () => {
    expect(puedeGenerarReportePdf(["reportes.*"])).toBe(true);
    expect(puedeGenerarReportePdf(["personal.*"])).toBe(false);
  });

  it("oculta los filtros de estructura sin organizacion.ver", () => {
    expect(puedeFiltrarEstructuraOrganizativa(["reportes.ver"])).toBe(false);
    expect(puedeFiltrarEstructuraOrganizativa(["organizacion.ver"])).toBe(true);
    expect(puedeFiltrarEstructuraOrganizativa([PERMISO_REPORTES.estructuraOrganizativa])).toBe(
      true,
    );
  });

  it("falla cerrado sin sesión o sin permisos", () => {
    expect(puedeGenerarReportePdf(undefined)).toBe(false);
    expect(puedeGenerarReportePdf([])).toBe(false);
    expect(puedeFiltrarEstructuraOrganizativa(null)).toBe(false);
  });

  it("expone los códigos reales del seed", () => {
    expect(PERMISO_REPORTES.ver).toBe("reportes.ver");
    expect(PERMISO_REPORTES.generarPdf).toBe("reportes.generar_pdf");
    expect(PERMISO_REPORTES.generarExcel).toBe("reportes.generar_excel");
  });
});
