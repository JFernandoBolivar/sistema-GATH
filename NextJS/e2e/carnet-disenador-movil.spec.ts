/**
 * E2E del diseñador de carnets en viewport de teléfono (390×844).
 *
 * Verifica:
 * 1. El lienzo (canvas Konva) es visible desde el inicio.
 * 2. Se puede abrir el panel «Capas» desde la barra inferior.
 * 3. Al pulsar un elemento de Capas se abre automáticamente el panel «Propiedades».
 * 4. El lienzo sigue visible en pantalla tras interactuar.
 *
 * Patrón de login copiado de carnet-disenador-imprime.spec.ts.
 */

import { expect, test, type Page } from "@playwright/test";
import { EMAIL, PASSWORD } from "./credenciales";
import { iniciarSesionComo } from "./inicio-sesion";

const DJANGO = process.env.E2E_DJANGO_URL ?? "http://127.0.0.1:8001";
const API = `${DJANGO}/api/v1/carnetizacion`;

/** Obtiene las cabeceras de autenticación a partir de la cookie de sesión. */
async function cabeceras(page: Page): Promise<Record<string, string>> {
  const token = (await page.context().cookies()).find((c) => c.name === "dj_access")?.value;
  expect(token, "la sesión debe tener la cookie dj_access").toBeTruthy();
  return { Authorization: `Bearer ${token}` };
}

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});

test.describe("Diseñador de carnet — vista móvil (390×844)", () => {
  test("lienzo visible, apertura de Capas, selección abre Propiedades", async ({ page }) => {
    let plantillaId = "";

    await iniciarSesionComo(page, EMAIL, PASSWORD);
    const auth = await cabeceras(page);
    page.setDefaultTimeout(30_000);

    try {
      // Crear plantilla temporal con un elemento para probar la selección
      const rect = {
        id: "e2e-caja",
        tipo: "rect",
        nombre: "Caja E2E",
        x: 5,
        y: 5,
        w: 20,
        h: 20,
        props: { fill: "#ff0000" },
      };
      const creada = await page.request.post(`${API}/plantillas-motor/`, {
        headers: auth,
        data: {
          nombre: `E2E móvil ${Date.now().toString(36)}`,
          definicion: { anverso: [rect], reverso: [] },
        },
      });
      expect(creada.status(), await creada.text()).toBe(201);
      plantillaId = String(((await creada.json()) as { data: { id: string } }).data.id);

      // 1. Abrir el diseñador y esperar a que cargue el lienzo
      await page.goto(`/carnetizacion/disenador?plantilla=${plantillaId}`, {
        waitUntil: "domcontentloaded",
      });

      // El canvas (stage de Konva) debe estar visible desde el inicio
      const canvas = page.locator("canvas").first();
      await expect(canvas).toBeVisible({ timeout: 20_000 });

      // 2. Abrir el panel «Capas» desde la barra inferior
      const botonCapas = page.getByRole("button", { name: "Panel de capas", exact: true });
      await expect(botonCapas).toBeVisible();
      await botonCapas.click();

      // El drawer debe abrirse mostrando el panel de Capas
      await expect(page.getByText(/capas \(anverso\)/i)).toBeVisible({ timeout: 10_000 });

      // 3. Seleccionar una fila concreta del panel Capas (por el texto del elemento)
      const drawer = page.locator("[data-slot='panel-movil']");
      // Las filas de capas se identifican por el nombre del elemento (no por el primer botón,
      // que sería «Subir nivel», deshabilitado).
      const filaElemento = drawer.getByText("Caja E2E");
      await expect(filaElemento).toBeVisible({ timeout: 10_000 });
      await filaElemento.click();

      // 4. El panel «Propiedades» se abre automáticamente al seleccionar
      await expect(page.getByRole("button", { name: "Panel de propiedades", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
        { timeout: 5_000 },
      );
      await expect(drawer.getByRole("heading", { name: "Propiedades", exact: true })).toBeVisible({
        timeout: 5_000,
      });

      // La barra inferior sigue visible y usable con el drawer abierto
      await expect(page.getByRole("button", { name: "Panel de capas", exact: true })).toBeVisible();

      // 5. El lienzo sigue completo dentro del viewport (390×844), sin quedar tapado por el drawer
      await expect(canvas).toBeVisible();
      const bbox = await canvas.boundingBox();
      expect(bbox, "el canvas debe tener dimensiones visibles").toBeTruthy();
      if (bbox) {
        expect(bbox.width).toBeGreaterThan(0);
        expect(bbox.height).toBeGreaterThan(0);
        expect(bbox.x).toBeGreaterThanOrEqual(0);
        expect(bbox.y).toBeGreaterThanOrEqual(0);
        expect(bbox.x + bbox.width).toBeLessThanOrEqual(390);
        expect(bbox.y + bbox.height).toBeLessThanOrEqual(844);
        const cajaDrawer = await drawer.boundingBox();
        if (cajaDrawer) expect(bbox.y + bbox.height).toBeLessThanOrEqual(cajaDrawer.y + 1);
      }
    } finally {
      if (plantillaId) {
        await page.request.delete(`${API}/plantillas-motor/${plantillaId}/`, { headers: auth });
      }
    }
  });
});
