import { expect, test } from "@playwright/test";

import { EMAIL, PASSWORD } from "./credenciales";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * D11/B5: si la llamada que trae los días sugeridos de fe de vida falla, el
 * selector debe mostrar el respaldo de 5 chips del dominio (30, 15, 7, 3, 1).
 */
test("B5: el selector de recordatorios usa el respaldo si el servidor falla", async ({ page }) => {
  await iniciarSesionComo(page, EMAIL, PASSWORD);

  // Aborta solo el POST de la Server Action que trae el parámetro; la página carga normal.
  await page.route("**/personal/fe-de-vida/procesos", (route) => {
    const peticion = route.request();
    if (peticion.method() === "POST" && peticion.headers()["next-action"]) {
      return route.abort();
    }
    return route.continue();
  });

  await page.goto("/personal/fe-de-vida/procesos");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByRole("button", { name: /Nuevo proceso/i }).click();

  for (const dia of [30, 15, 7, 3, 1]) {
    await expect(
      page.getByRole("button", { name: `${dia} ${dia === 1 ? "día" : "días"} antes` }),
    ).toBeVisible({ timeout: 20_000 });
  }
});
