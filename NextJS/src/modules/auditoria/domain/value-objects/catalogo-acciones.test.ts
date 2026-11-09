import { describe, expect, it } from "vitest";
import {
  CATALOGO_ACCIONES,
  NOMBRES_MODULOS,
  obtenerAccionesAgrupadas,
  obtenerEtiquetaAccion,
  obtenerSeveridadAccion,
} from "./catalogo-acciones";

describe("Catálogo de acciones de auditoría (FIX-DIS4)", () => {
  it("cada acción en el catálogo tiene una etiqueta legible en español, módulo y severidad", () => {
    const entradas = Object.entries(CATALOGO_ACCIONES);
    expect(entradas.length).toBeGreaterThan(25);

    for (const [codigo, def] of entradas) {
      expect(def.codigo).toBe(codigo);
      expect(def.etiqueta).toBeTruthy();
      expect(def.etiqueta.trim().length).toBeGreaterThan(3);
      // No debe ser idéntico al código técnico si tiene guiones bajos o puntos
      if (codigo.includes("_") || codigo.includes(".")) {
        expect(def.etiqueta).not.toBe(codigo);
      }
      expect(def.modulo).toBeTruthy();
      expect(def.moduloVisible).toBeTruthy();
      expect(["creacion", "actualizacion", "aprobacion", "advertencia", "peligro", "consulta"]).toContain(
        def.severidad,
      );
    }
  });

  it("acciones críticas del sistema están catalogadas con etiqueta adecuada", () => {
    const accionesEsperadas = [
      "APROBACION_DIRECTA_ADMINISTRADORA",
      "CHECK_DADO",
      "CHECK_RETIRADO",
      "DEVUELTA",
      "ANULADA",
      "VENCIDA",
      "PRORROGA_CONCEDIDA",
      "CONSTANCIA_REGENERADA",
      "personal.crear",
      "personal.editar",
      "movimientos.registrar",
      "pasivos.pasivo_creado",
      "pasivos.pasivo_actualizado",
      "identidad.alta_usuario",
      "identidad.acceso_restablecido",
      "identidad.rol_actualizado",
      "configuracion.parametro_actualizado",
      "CARGA_MASIVA_REGISTRO_APLICADO",
      "EMISION",
      "ESCANEO",
      "puntocuenta.configuracion_actualizada",
    ];

    for (const accion of accionesEsperadas) {
      expect(
        CATALOGO_ACCIONES[accion],
        `La acción «${accion}» debe estar registrada en CATALOGO_ACCIONES con su etiqueta`,
      ).toBeDefined();
      expect(CATALOGO_ACCIONES[accion]?.etiqueta).toBeTruthy();
    }
  });

  it("obtenerEtiquetaAccion retorna la etiqueta amigable y no el código técnico", () => {
    expect(obtenerEtiquetaAccion("APROBACION_DIRECTA_ADMINISTRADORA")).toBe(
      "Aprobación directa por administradora",
    );
    expect(obtenerEtiquetaAccion("configuracion.parametro_actualizado")).toBe(
      "Actualización de parámetro general",
    );
    expect(obtenerEtiquetaAccion("identidad.alta_usuario")).toBe("Creación de usuario");
    expect(obtenerEtiquetaAccion("EMISION")).toBe("Emisión de credencial / carnet");
  });

  it("obtenerEtiquetaAccion genera etiqueta legible para acciones dinámicas desconocidas", () => {
    const etiqueta = obtenerEtiquetaAccion("modulo_nuevo.accion_especifica");
    expect(etiqueta).toBe("Modulo Nuevo Accion Especifica");
    expect(obtenerEtiquetaAccion("")).toBe("—");
  });

  it("obtenerSeveridadAccion mapea correctamente la severidad de las acciones", () => {
    expect(obtenerSeveridadAccion("identidad.alta_usuario")).toBe("creacion");
    expect(obtenerSeveridadAccion("ANULADA")).toBe("peligro");
    expect(obtenerSeveridadAccion("DEVUELTA")).toBe("advertencia");
    expect(obtenerSeveridadAccion("CHECK_DADO")).toBe("aprobacion");
    expect(obtenerSeveridadAccion("probar")).toBe("consulta");
  });

  it("obtenerAccionesAgrupadas agrupa correctamente por módulo y ordena alfabéticamente", () => {
    const grupos = obtenerAccionesAgrupadas(["accion_inventada.test"]);
    expect(grupos.length).toBeGreaterThan(0);

    for (const grupo of grupos) {
      expect(grupo.modulo).toBeTruthy();
      expect(grupo.moduloVisible).toBeTruthy();
      expect(grupo.acciones.length).toBeGreaterThan(0);
      for (const item of grupo.acciones) {
        expect(item.codigo).toBeTruthy();
        expect(item.etiqueta).toBeTruthy();
      }
    }

    const grupoFeDeVida = grupos.find((g) => g.modulo === "fe_de_vida");
    expect(grupoFeDeVida).toBeDefined();
    expect(grupoFeDeVida?.moduloVisible).toBe("Fe de Vida");
    expect(
      grupoFeDeVida?.acciones.some((a) => a.codigo === "APROBACION_DIRECTA_ADMINISTRADORA"),
    ).toBe(true);
  });
});
