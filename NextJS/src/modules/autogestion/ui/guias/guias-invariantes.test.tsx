import { describe, it, expect } from "vitest";
import {
  GUIA_AUTOGESTION_INICIO,
  GUIA_MI_FICHA,
  GUIA_NUEVA_SOLICITUD,
} from "./definiciones-guias";

describe("Invariantes de Guías Interactivas (O35)", () => {
  const GUIAS = [
    GUIA_AUTOGESTION_INICIO,
    GUIA_MI_FICHA,
    GUIA_NUEVA_SOLICITUD,
  ];

  it("todas las guías tienen identificador, versión válida y título no vacío", () => {
    for (const guia of GUIAS) {
      expect(guia.id).toBeTruthy();
      expect(guia.version).toBeGreaterThanOrEqual(1);
      expect(guia.titulo.trim().length).toBeGreaterThan(3);
      expect(guia.pasos.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("todos los pasos tienen selectores válidos con formato data-guia-id", () => {
    const patronSelector = /^\[data-guia-id='[a-zA-Z0-9_-]+'\]$/;

    for (const guia of GUIAS) {
      const idsVistos = new Set<string>();

      for (const paso of guia.pasos) {
        expect(paso.id).toBeTruthy();
        expect(idsVistos.has(paso.id)).toBe(false);
        idsVistos.add(paso.id);

        expect(paso.selector).toMatch(patronSelector);
        expect(paso.titulo.trim().length).toBeGreaterThan(3);
        expect(paso.descripcion.trim().length).toBeGreaterThan(15);
      }
    }
  });

  it("verifica que los data-guia-id de Inicio de Autogestión están definidos y son únicos", () => {
    const idsEsperados = [
      "inicio-cabecera",
      "inicio-boton-solicitar",
      "inicio-pestanas",
      "inicio-menu-lateral",
      "inicio-tamano-texto",
    ];

    const selectores = GUIA_AUTOGESTION_INICIO.pasos.map((p) => p.selector);
    for (const id of idsEsperados) {
      expect(selectores).toContain(`[data-guia-id='${id}']`);
    }
  });

  it("verifica que los data-guia-id de Mi Ficha están definidos y son únicos", () => {
    const idsEsperados = [
      "ficha-datos-personales",
      "ficha-datos-laborales",
      "ficha-carnet",
      "ficha-reportar-error",
      "ficha-solicitar",
    ];

    const selectores = GUIA_MI_FICHA.pasos.map((p) => p.selector);
    for (const id of idsEsperados) {
      expect(selectores).toContain(`[data-guia-id='${id}']`);
    }
  });

  it("verifica que los data-guia-id de Nueva Solicitud están definidos y son únicos", () => {
    const idsEsperados = [
      "solicitud-selector-campos",
      "solicitud-motivo",
      "solicitud-boton-enviar",
    ];

    const selectores = GUIA_NUEVA_SOLICITUD.pasos.map((p) => p.selector);
    for (const id of idsEsperados) {
      expect(selectores).toContain(`[data-guia-id='${id}']`);
    }
  });
});
