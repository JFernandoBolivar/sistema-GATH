import { expect, test, type Page } from "@playwright/test";

import { EMAIL, PASSWORD } from "./credenciales";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * Lo diseñado es lo guardado (seguimiento A-2, A-3):
 *
 *  - Una imagen elegida en la Biblioteca de Medios se guarda en la plantilla
 *    (`props.biblioteca_id`) y vuelve a mostrarse al recargar el diseñador.
 *  - La opacidad y la rotación del panel de propiedades se guardan y se recuperan.
 *  - La miniatura de la lista de plantillas muestra la imagen, girada y translúcida.
 *
 * La prueba sube su propia imagen y crea su propia plantilla borrador por la API,
 * y borra ambas al terminar: no toca plantillas ni medios reales.
 * El backend se consulta directo (E2E_DJANGO_URL, por defecto el 8001 del compose).
 */
const DJANGO = process.env.E2E_DJANGO_URL ?? "http://127.0.0.1:8001";
const API = `${DJANGO}/api/v1/carnetizacion`;

// PNG de 48 x 24 px (damero azul/rojo), suficiente para comprobar que se dibuja.
const PNG_PRUEBA = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAADAAAAAYCAYAAAC8/X7cAAAASElEQVR42mOQt4r/jw0/lPXAigebeoZRD4x6YNQDQ9wDQ8WhuNSPemDUA6MeGOoeGK0HRj0w6oFRD4y2hUYrslEPjHpgBHsAALNt93nI37iKAAAAAElFTkSuQmCC",
  "base64",
);

type Elemento = { id: string; tipo: string; r?: number; op?: number; props?: Record<string, unknown> };

async function cabeceras(page: Page): Promise<Record<string, string>> {
  const token = (await page.context().cookies()).find((c) => c.name === "dj_access")?.value;
  expect(token, "la sesión debe tener la cookie dj_access").toBeTruthy();
  return { Authorization: `Bearer ${token}` };
}

test.describe("Diseñador de carnet: imagen de biblioteca, rotación y opacidad", () => {
  test("se guardan, se recuperan al recargar y se ven en la miniatura", async ({ page }) => {
    const sufijo = Date.now().toString(36);
    const nombreMedio = `E2E imagen ${sufijo}`;
    const nombrePlantilla = `E2E diseñador ${sufijo}`;
    let medioId = "";
    let plantillaId = "";

    await iniciarSesionComo(page, EMAIL, PASSWORD);
    const auth = await cabeceras(page);
    // Que un paso de interfaz falle pronto y deje tiempo a la limpieza del `finally`.
    page.setDefaultTimeout(30_000);

    try {
      const subida = await page.request.post(`${API}/biblioteca/`, {
        headers: auth,
        multipart: {
          nombre: nombreMedio,
          categoria: "imagen",
          archivo: { name: "e2e.png", mimeType: "image/png", buffer: PNG_PRUEBA },
        },
      });
      expect(subida.status(), await subida.text()).toBe(201);
      medioId = String(((await subida.json()) as { data: { id: string } }).data.id);

      const creada = await page.request.post(`${API}/plantillas-motor/`, {
        headers: auth,
        data: { nombre: nombrePlantilla, definicion: { anverso: [], reverso: [] } },
      });
      expect(creada.status(), await creada.text()).toBe(201);
      plantillaId = String(((await creada.json()) as { data: { id: string } }).data.id);

      // 1. Insertar la imagen desde la biblioteca, bajar la opacidad y girarla.
      await page.goto(`/carnetizacion/disenador?plantilla=${plantillaId}`);
      // El botón «Elegir de biblioteca de medios» vive en el panel «Agregar» y el panel
      // izquierdo por defecto es «Capas»: primero se abre «Agregar» desde la barra de íconos.
      await page.getByRole("button", { name: /panel de herramientas para agregar elementos/i }).click();
      await page.getByRole("button", { name: /elegir de biblioteca de medios/i }).click();
      await page.getByRole("dialog").getByText(nombreMedio).click();

      const opacidad = page.getByRole("slider").first();
      await opacidad.focus();
      await page.keyboard.press("Home");
      for (let i = 0; i < 4; i++) await page.keyboard.press("PageUp");
      await expect(page.getByText("40 %")).toBeVisible();

      await page.getByLabel("Rotación en grados").fill("30");

      // Vista previa con el motor PDF (B-1), de los cambios aún sin guardar: dos caras.
      await page.getByRole("button", { name: /vista previa pdf/i }).click();
      const dialogo = page.getByRole("dialog");
      await expect(dialogo.getByRole("img", { name: /impresión: anverso/i })).toBeVisible();
      await expect(dialogo.getByRole("img", { name: /impresión: reverso/i })).toBeVisible();
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: /guardar borrador/i }).click();
      await expect(page.getByText(/plantilla guardada/i)).toBeVisible();

      // 2. Lo guardado lleva la imagen, la opacidad y la rotación.
      const detalle = await page.request.get(`${API}/plantillas-motor/${plantillaId}/`, { headers: auth });
      const definicion = ((await detalle.json()) as { data: { definicion: { anverso: Elemento[] } } }).data
        .definicion;
      const imagen = definicion.anverso.find((e) => e.tipo === "image");
      expect(imagen?.props?.biblioteca_id).toBe(medioId);
      expect(imagen?.op).toBe(40);
      expect(imagen?.r).toBe(30);

      // 3. Al recargar, el diseñador vuelve a pedir la imagen y la muestra girada y translúcida.
      const archivo = page.waitForResponse(
        (r) => r.url().includes(`/biblioteca/${medioId}/archivo`) && r.status() === 200,
      );
      await page.reload();
      await archivo;
      await expect
        .poll(() =>
          page.evaluate(() => {
            const konva = (window as unknown as { Konva?: { stages: Array<{ find: (s: string) => unknown[] }> } })
              .Konva;
            const imagenes = (konva?.stages[0]?.find("Image") ?? []) as Array<{
              getParent: () => { rotation: () => number; opacity: () => number };
            }>;
            return imagenes.map((i) => [Math.round(i.getParent().rotation()), i.getParent().opacity()]);
          }),
        )
        .toContainEqual([30, 0.4]);

      // 4. La miniatura de la lista de plantillas muestra la imagen con su giro y opacidad.
      await page.goto("/carnetizacion/plantillas");
      const miniatura = page.locator(`svg[aria-label*="${nombrePlantilla}"]`).first();
      await expect(miniatura).toBeVisible();
      const grupo = miniatura.locator("g[transform^='rotate(30']");
      await expect(grupo).toHaveAttribute("opacity", "0.4");
      await expect(grupo.locator("image")).toHaveAttribute("href", new RegExp(`/biblioteca/${medioId}/archivo/`));
    } finally {
      if (plantillaId) await page.request.delete(`${API}/plantillas-motor/${plantillaId}/`, { headers: auth });
      if (medioId) await page.request.delete(`${API}/biblioteca/${medioId}/`, { headers: auth });
    }
  });
});
