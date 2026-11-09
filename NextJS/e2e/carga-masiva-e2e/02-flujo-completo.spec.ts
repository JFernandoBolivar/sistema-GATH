import { test, expect } from "@playwright/test";
import path from "path";
import { execSync } from "child_process";
import { iniciarSesion, tomarCaptura, verificarSinDesborde } from "./helpers";

test.describe("Caso 1: Flujo Completo de Carga Masiva (Activos y Pasivos)", () => {
  test("C01 - Activos: Subida -> Análisis (documentación DEF-01) -> Historial -> Modal -> Aplicar -> Revertir", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    await iniciarSesion(page);
    await page.goto("/personal/carga-masiva");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Paso 1: Avanzar a Paso 2
    const btnListo = page.getByRole("button", { name: /ya tengo el archivo listo/i });
    await expect(btnListo).toBeVisible();
    await btnListo.click();

    // Paso 2: Subir archivo c01_activos_valido.xlsx
    const rutaArchivo = path.resolve(__dirname, "fixtures/c01_activos_valido.xlsx");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(rutaArchivo);
    await tomarCaptura(page, `c01-${prefix}-01-paso2-subida.png`);
    expect(await verificarSinDesborde(page, "Paso 2 Subida Activos")).toBeTruthy();

    // Enviar a analizar
    const btnAnalizar = page.getByRole("button", { name: /analizar archivo/i });
    await expect(btnAnalizar).toBeEnabled();
    await btnAnalizar.click();

    // Esperar respuesta de la API o notificación Toast
    // Documentación del DEF-01: paso-subir-archivo.tsx comprueba !data.ok, pero el sobre C-1 devuelve status:"success"
    await page.waitForTimeout(3000);
    await tomarCaptura(page, `c01-${prefix}-02-toast-defecto-subida.png`);

    // Cambiar a la pestaña "Historial de Cargas" para continuar con la verificación
    const tabHistorial = page.getByRole("tab", { name: /historial de cargas/i });
    await expect(tabHistorial).toBeVisible();
    await tabHistorial.click();
    await page.waitForLoadState("networkidle").catch(() => {});

    // En Historial debe aparecer la carga recién analizada
    await expect(page.getByText(/c01_activos_valido\.xlsx/i).first()).toBeVisible({ timeout: 20_000 });
    await tomarCaptura(page, `c01-${prefix}-03-historial-analizada.png`);
    expect(await verificarSinDesborde(page, "Historial Carga Analizada")).toBeTruthy();

    // Abrir Modal de Detalle de Carga
    const btnVerDetalle = page.getByTitle(/ver detalle de filas/i).first();
    await expect(btnVerDetalle).toBeVisible();
    await btnVerDetalle.click();

    // Verificar modal de detalle histórico
    await expect(page.getByRole("heading", { name: /detalle de carga/i })).toBeVisible();
    await page.waitForTimeout(1000);
    await tomarCaptura(page, `c01-${prefix}-04-modal-detalle-historial.png`);
    expect(await verificarSinDesborde(page, "Modal Detalle Historial")).toBeTruthy();

    // Cerrar modal
    await page.keyboard.press("Escape");

    // Aplicar la carga desde Historial (botón Play)
    const btnAplicar = page.getByTitle(/aplicar carga masiva/i).first();
    await expect(btnAplicar).toBeVisible();
    await btnAplicar.click();

    // Esperar a que el badge cambie a APLICADA
    await expect(page.getByText(/aplicada/i).first()).toBeVisible({ timeout: 35_000 });
    await tomarCaptura(page, `c01-${prefix}-05-historial-aplicada.png`);
    expect(await verificarSinDesborde(page, "Historial Carga Aplicada")).toBeTruthy();

    // Verificar en BD que los empleados activos fueron creados
    const checkBd = execSync(
      'docker compose exec -T django python manage.py shell -c "from apps.personal.infrastructure.models.personal_models import EmployeeModel; print(\'EMPS_COUNT:\', EmployeeModel.objects.filter(cedulaidentidad__in=[\'88001001\', \'88001002\']).count())"',
      { encoding: "utf-8" }
    );
    expect(checkBd).toContain("EMPS_COUNT: 2");

    // Revertir la carga desde Historial
    const btnRevertir = page.getByTitle(/revertir carga completa/i).first();
    await expect(btnRevertir).toBeVisible();
    await btnRevertir.click();

    // Diálogo de confirmación de reversión
    const btnConfirmarRev = page.getByRole("button", { name: /revertir carga/i }).filter({ hasText: /revertir/i }).last();
    await expect(btnConfirmarRev).toBeVisible();
    await btnConfirmarRev.click();

    // Esperar badge REVERTIDA
    await expect(page.getByText(/revertida/i).first()).toBeVisible({ timeout: 35_000 });
    await tomarCaptura(page, `c01-${prefix}-06-historial-revertida.png`);
    expect(await verificarSinDesborde(page, "Historial Carga Revertida")).toBeTruthy();

    // Verificar en BD que los empleados fueron eliminados por el rollback
    const checkBdPost = execSync(
      'docker compose exec -T django python manage.py shell -c "from apps.personal.infrastructure.models.personal_models import EmployeeModel; print(\'EMPS_POST:\', EmployeeModel.objects.filter(cedulaidentidad__in=[\'88001001\', \'88001002\']).count())"',
      { encoding: "utf-8" }
    );
    expect(checkBdPost).toContain("EMPS_POST: 0");
  });

  test("C01b - Pasivos: Flujo Completo en Pasivos y Reversión", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    await iniciarSesion(page);
    await page.goto("/pasivos/carga-masiva");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Paso 1: Avanzar a Paso 2
    const btnListo = page.getByRole("button", { name: /ya tengo el archivo listo/i });
    await expect(btnListo).toBeVisible();
    await btnListo.click();

    // Paso 2: Subir archivo c01_pasivos_valido.xlsx
    const rutaArchivo = path.resolve(__dirname, "fixtures/c01_pasivos_valido.xlsx");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(rutaArchivo);
    await tomarCaptura(page, `c01b-${prefix}-01-paso2-subida.png`);
    expect(await verificarSinDesborde(page, "Paso 2 Subida Pasivos")).toBeTruthy();

    const btnAnalizar = page.getByRole("button", { name: /analizar archivo/i });
    await btnAnalizar.click();
    await page.waitForTimeout(3000);

    // Ir a Historial
    const tabHistorial = page.getByRole("tab", { name: /historial de cargas/i });
    await tabHistorial.click();
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(page.getByText(/c01_pasivos_valido\.xlsx/i).first()).toBeVisible({ timeout: 20_000 });
    await tomarCaptura(page, `c01b-${prefix}-02-historial-analizada.png`);
    expect(await verificarSinDesborde(page, "Historial Pasivos Analizada")).toBeTruthy();

    // Pequeña espera para evitar rate limiting (429) en endpoints de mutación
    await page.waitForTimeout(3000);

    // Aplicar
    const btnAplicar = page.getByTitle(/aplicar carga masiva/i).first();
    await expect(btnAplicar).toBeVisible();
    await btnAplicar.click();

    await expect(page.getByText(/aplicada/i).first()).toBeVisible({ timeout: 35_000 });
    await tomarCaptura(page, `c01b-${prefix}-03-historial-aplicada.png`);

    // Revertir
    const btnRevertir = page.getByTitle(/revertir carga completa/i).first();
    await expect(btnRevertir).toBeVisible();
    await btnRevertir.click();

    const btnConfirmarRev = page.getByRole("button", { name: /revertir carga/i }).filter({ hasText: /revertir/i }).last();
    await btnConfirmarRev.click();

    await expect(page.getByText(/revertida/i).first()).toBeVisible({ timeout: 35_000 });
    await tomarCaptura(page, `c01b-${prefix}-04-historial-revertida.png`);
    expect(await verificarSinDesborde(page, "Historial Pasivos Revertida")).toBeTruthy();
  });
});
