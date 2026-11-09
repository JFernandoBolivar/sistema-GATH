import { test, expect } from "@playwright/test";
import path from "path";
import { iniciarSesion, tomarCaptura, verificarSinDesborde } from "./helpers";

test.describe("Caso 1: Flujo Completo de Carga Masiva (Activos y Pasivos)", () => {
  test("C01 - Activos: Plantilla -> Subida -> Análisis -> Modal -> Aplicar -> Historial -> Revertir", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    await iniciarSesion(page);

    page.on("console", (msg) => console.log("BROWSER CONSOLE:", msg.type(), msg.text()));

    page.on("response", async (res) => {
      if (res.url().includes("carga-masiva")) {
        console.log("CARGA-MASIVA API RESPONSE:", res.status(), res.url());
        try {
          const txt = await res.text();
          console.log("RESPONSE BODY:", txt);
        } catch {}
      }
    });

    await page.goto("/personal/carga-masiva");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Paso 1: Avanzar
    const btnListo = page.getByRole("button", { name: /ya tengo el archivo listo/i });
    await expect(btnListo).toBeVisible();
    await btnListo.click();

    // Paso 2: Subir archivo
    const rutaArchivo = path.resolve(__dirname, "fixtures/c01_activos_valido_alt.xlsx");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(rutaArchivo);
    await tomarCaptura(page, `c01-${prefix}-paso2-subida.png`);
    expect(await verificarSinDesborde(page, "Paso 2 Subida")).toBeTruthy();

    const btnAnalizar = page.getByRole("button", { name: /analizar archivo/i });
    await expect(btnAnalizar).toBeEnabled();
    await btnAnalizar.click();

    // Paso 3: Revisión de Análisis
    await expect(page.getByText(/paso 3: resultados del análisis/i)).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(/2 válidas/i).first()).toBeVisible();
    await tomarCaptura(page, `c01-${prefix}-paso3-analisis.png`);
    expect(await verificarSinDesborde(page, "Paso 3 Análisis")).toBeTruthy();

    // Probar filtro por estado
    const selectFiltro = page.locator("select, button").filter({ hasText: /todas|nuevo/i }).first();
    if (await selectFiltro.isVisible()) {
      await selectFiltro.click();
    }

    // Modal de Inspección de Fila
    // El botón de la fila ahora se identifica por su título accesible.
    const btnVerDetalle = page.getByTitle(/ver datos de la fila/i).first();
    await expect(btnVerDetalle).toBeVisible();
    await btnVerDetalle.click();

    const dialogTitle = page.getByRole("heading", { name: /fila n.º/i });
    await expect(dialogTitle).toBeVisible();
    await tomarCaptura(page, `c01-${prefix}-modal-detalle-fila.png`);
    expect(await verificarSinDesborde(page, "Modal Detalle Fila")).toBeTruthy();

    // Cerrar modal presionando Escape
    await page.keyboard.press("Escape");
    await expect(dialogTitle).not.toBeVisible();

    // Avanzar a Paso 4
    const btnContinuar = page.getByRole("button", { name: /continuar a confirmación/i });
    await expect(btnContinuar).toBeEnabled();
    await btnContinuar.click();

    // Paso 4: Confirmación y Aplicación
    await expect(page.getByText(/paso 4: confirmación y aplicación/i)).toBeVisible({ timeout: 30_000 });
    await tomarCaptura(page, `c01-${prefix}-paso4-confirmacion.png`);
    expect(await verificarSinDesborde(page, "Paso 4 Confirmación")).toBeTruthy();

    const btnAplicar = page.getByRole("button", { name: /aplicar/i }).filter({ hasText: /registro/i });
    await expect(btnAplicar).toBeEnabled();
    await btnAplicar.click();

    // Esperar resultado final
    await expect(page.getByText(/¡carga masiva aplicada exitosamente!/i)).toBeVisible({ timeout: 45_000 });
    await tomarCaptura(page, `c01-${prefix}-paso4-completado.png`);
    expect(await verificarSinDesborde(page, "Paso 4 Completado")).toBeTruthy();

    // Ir al Historial
    const btnHistorial = page.getByRole("button", { name: /ir al historial de cargas/i });
    await btnHistorial.click();

    // Validar en Historial
    await expect(page.getByText(/historial de cargas masivas/i)).toBeVisible({ timeout: 30_000 });
    const badgeAplicada = page.getByText(/aplicada/i).first();
    await expect(badgeAplicada).toBeVisible();
    await tomarCaptura(page, `c01-${prefix}-historial-aplicada.png`);
    expect(await verificarSinDesborde(page, "Historial Aplicada")).toBeTruthy();

    // Revertir carga
    const btnRevertir = page.getByTitle(/revertir carga completa/i).first();
    await expect(btnRevertir).toBeVisible();
    await btnRevertir.click();

    // Cuadro de confirmación de reversión
    const btnConfirmarReversion = page.getByRole("button", { name: /revertir carga/i }).filter({ hasText: /revertir/i }).last();
    await expect(btnConfirmarReversion).toBeVisible();
    await btnConfirmarReversion.click();

    // Esperar badge REVERTIDA
    await expect(page.getByText(/revertida/i).first()).toBeVisible({ timeout: 35_000 });
    await tomarCaptura(page, `c01-${prefix}-historial-revertida.png`);
    expect(await verificarSinDesborde(page, "Historial Revertida")).toBeTruthy();
  });

  test("C01b - Pasivos: Flujo Completo con actualización de datos", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    await iniciarSesion(page);
    await page.goto("/pasivos/carga-masiva");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Paso 1: Avanzar
    const btnListo = page.getByRole("button", { name: /ya tengo el archivo listo/i });
    await expect(btnListo).toBeVisible();
    await btnListo.click();

    // Paso 2: Subir archivo de pasivo
    const rutaArchivo = path.resolve(__dirname, "fixtures/c01_pasivos_valido_alt.xlsx");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(rutaArchivo);
    await tomarCaptura(page, `c01b-${prefix}-paso2-subida.png`);
    expect(await verificarSinDesborde(page, "Paso 2 Subida Pasivos")).toBeTruthy();

    const btnAnalizar = page.getByRole("button", { name: /analizar archivo/i });
    await btnAnalizar.click();

    // Paso 3: Revisión de Análisis
    await expect(page.getByText(/paso 3: resultados del análisis/i)).toBeVisible({ timeout: 45_000 });
    await tomarCaptura(page, `c01b-${prefix}-paso3-analisis.png`);
    expect(await verificarSinDesborde(page, "Paso 3 Análisis Pasivos")).toBeTruthy();

    // Continuar a Paso 4
    const btnContinuar = page.getByRole("button", { name: /continuar a confirmación/i });
    await expect(btnContinuar).toBeEnabled();
    await btnContinuar.click();

    // Paso 4: Aplicar
    await expect(page.getByText(/paso 4: confirmación y aplicación/i)).toBeVisible({ timeout: 30_000 });
    const btnAplicar = page.getByRole("button", { name: /aplicar/i }).filter({ hasText: /registro/i });
    await expect(btnAplicar).toBeEnabled();
    await btnAplicar.click();

    await expect(page.getByText(/¡carga masiva aplicada exitosamente!/i)).toBeVisible({ timeout: 45_000 });
    await tomarCaptura(page, `c01b-${prefix}-paso4-completado.png`);

    // Ir a Historial y revertir
    const btnHistorial = page.getByRole("button", { name: /ir al historial de cargas/i });
    await btnHistorial.click();

    await expect(page.getByText(/historial de cargas masivas/i)).toBeVisible({ timeout: 30_000 });
    const btnRevertir = page.getByTitle(/revertir carga completa/i).first();
    await expect(btnRevertir).toBeVisible();
    await btnRevertir.click();

    const btnConfirmarReversion = page.getByRole("button", { name: /revertir carga/i }).filter({ hasText: /revertir/i }).last();
    await btnConfirmarReversion.click();

    await expect(page.getByText(/revertida/i).first()).toBeVisible({ timeout: 35_000 });
    await tomarCaptura(page, `c01b-${prefix}-historial-revertida.png`);
    expect(await verificarSinDesborde(page, "Historial Pasivos Revertida")).toBeTruthy();
  });
});
