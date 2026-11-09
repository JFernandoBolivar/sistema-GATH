import { test, expect } from "@playwright/test";
import path from "path";
import { iniciarSesion, tomarCaptura, verificarSinDesborde } from "./helpers";

test.describe("Suite 03: Validaciones de Errores y Casos Borde", () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page);
    await page.goto("/personal/carga-masiva");
    await page.waitForLoadState("networkidle").catch(() => {});
  });

  // Helper para subir archivo en el Asistente
  async function subirArchivoEnAsistente(page: any, nombreArchivo: string, esperaMs = 8000) {
    const btnListo = page.getByRole("button", { name: /ya tengo el archivo listo/i });
    if (await btnListo.isVisible()) {
      await btnListo.click();
    }
    const rutaArchivo = path.resolve(__dirname, `fixtures/${nombreArchivo}`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(rutaArchivo);
    const btnAnalizar = page.getByRole("button", { name: /analizar archivo/i });
    await expect(btnAnalizar).toBeEnabled();
    await btnAnalizar.click();
    // Espaciamiento para evitar sobrecargar upload throttle (20/min)
    await page.waitForTimeout(esperaMs);
  }

  // Helper para ir a Historial y abrir detalle de la última carga
  async function abrirDetalleUltimaCarga(page: any, nombreArchivo: string) {
    const tabHistorial = page.getByRole("tab", { name: /historial de cargas/i });
    await tabHistorial.click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.getByText(nombreArchivo).first()).toBeVisible({ timeout: 20_000 });
    const btnVerDetalle = page.getByTitle(/ver detalle de filas/i).first();
    await expect(btnVerDetalle).toBeVisible();
    await btnVerDetalle.click();
    await expect(page.getByRole("heading", { name: /detalle de carga/i })).toBeVisible({ timeout: 10_000 });
  }

  test("C02 - Archivo vacío sin filas de datos", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    await subirArchivoEnAsistente(page, "c02_archivo_vacio.xlsx");
    await tomarCaptura(page, `c02-${prefix}-01-subida.png`);
    expect(await verificarSinDesborde(page, "C02 Subida")).toBeTruthy();

    await abrirDetalleUltimaCarga(page, "c02_archivo_vacio.xlsx");
    await tomarCaptura(page, `c02-${prefix}-02-detalle.png`);
    expect(await verificarSinDesborde(page, "C02 Detalle")).toBeTruthy();

    // Comprobar métricas: 0 filas totales
    await expect(page.getByText(/0 filas totales/i)).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("C03 - Formato no Excel o archivo renombrado", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    // El error de formato se muestra en un toast breve: no esperar el
    // espaciamiento largo de los casos exitosos.
    await subirArchivoEnAsistente(page, "c03_formato_no_excel.xlsx", 0);
    await tomarCaptura(page, `c03-${prefix}-01-error-formato.png`);
    expect(await verificarSinDesborde(page, "C03 Error Formato")).toBeTruthy();

    // Debe mostrar error claro en español por archivo inválido
    await expect(
      page.getByText(/no se pudo analizar el archivo|error al analizar|solo se admite/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("C04 - Columnas faltantes o alteradas", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    await subirArchivoEnAsistente(page, "c04_columnas_alteradas.xlsx");
    await abrirDetalleUltimaCarga(page, "c04_columnas_alteradas.xlsx");
    await tomarCaptura(page, `c04-${prefix}-01-columnas-alteradas.png`);
    expect(await verificarSinDesborde(page, "C04 Columnas Alteradas")).toBeTruthy();

    // Debe mostrar filas con error por campos obligatorios faltantes o catálogo alterado
    await expect(page.getByText(/con error/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("C05 - Filas duplicadas dentro del mismo archivo", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    await subirArchivoEnAsistente(page, "c05_filas_duplicadas.xlsx");
    await abrirDetalleUltimaCarga(page, "c05_filas_duplicadas.xlsx");
    await tomarCaptura(page, `c05-${prefix}-01-duplicados.png`);
    expect(await verificarSinDesborde(page, "C05 Duplicados")).toBeTruthy();

    // Filtrar por error o verificar mensaje exacto del analizador
    await expect(page.getByText(/duplicado dentro del archivo/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("C06 - Cédulas inexistentes en el sistema para actualización", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    await subirArchivoEnAsistente(page, "c06_cedula_invalida.xlsx");
    await abrirDetalleUltimaCarga(page, "c06_cedula_invalida.xlsx");
    await tomarCaptura(page, `c06-${prefix}-01-cedula-inexistente.png`);
    expect(await verificarSinDesborde(page, "C06 Cédula Inexistente")).toBeTruthy();

    await expect(page.getByText(/el trabajador no existe en el sistema/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("C07 - Fechas imposibles o en formato incorrecto", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    await subirArchivoEnAsistente(page, "c07_fechas_imposibles.xlsx");
    await abrirDetalleUltimaCarga(page, "c07_fechas_imposibles.xlsx");
    await tomarCaptura(page, `c07-${prefix}-01-fecha-invalida.png`);
    expect(await verificarSinDesborde(page, "C07 Fecha Inválida")).toBeTruthy();

    await expect(page.getByText(/fecha inválida/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("C08 - Valores fuera de catálogo", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    await subirArchivoEnAsistente(page, "c08_valores_fuera_catalogo.xlsx");
    await abrirDetalleUltimaCarga(page, "c08_valores_fuera_catalogo.xlsx");
    await tomarCaptura(page, `c08-${prefix}-01-catalogo-invalido.png`);
    expect(await verificarSinDesborde(page, "C08 Catálogo Inválido")).toBeTruthy();

    await expect(page.getByText(/valor fuera del catálogo/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("C09 - Campos obligatorios vacíos", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    await subirArchivoEnAsistente(page, "c09_campos_obligatorios_vacios.xlsx");
    await abrirDetalleUltimaCarga(page, "c09_campos_obligatorios_vacios.xlsx");
    await tomarCaptura(page, `c09-${prefix}-01-campos-vacios.png`);
    expect(await verificarSinDesborde(page, "C09 Campos Vacíos")).toBeTruthy();

    await expect(page.getByText(/obligatorio/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("C10 - Textos largos y caracteres especiales/acentos", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    await subirArchivoEnAsistente(page, "c10_textos_largos_especiales.xlsx");
    await abrirDetalleUltimaCarga(page, "c10_textos_largos_especiales.xlsx");
    await tomarCaptura(page, `c10-${prefix}-01-textos-largos.png`);
    expect(await verificarSinDesborde(page, "C10 Textos Largos")).toBeTruthy();

    // Debe mostrar la fila analizada (o con error de longitud si excede max_length)
    await expect(page.getByText(/c10_textos_largos_especiales\.xlsx/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("C16 - Subir dos veces el mismo archivo", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    // Primera subida
    await subirArchivoEnAsistente(page, "c16_archivo_duplicado.xlsx");
    // Esperar espaciamiento entre subidas para evitar throttle de subida
    await page.waitForTimeout(4000);

    // Segunda subida del mismo archivo
    await page.goto("/personal/carga-masiva");
    await page.waitForLoadState("networkidle").catch(() => {});
    await subirArchivoEnAsistente(page, "c16_archivo_duplicado.xlsx");

    // Verificar en Historial que ambas cargas coexisten como registros independientes
    const tabHistorial = page.getByRole("tab", { name: /historial de cargas/i });
    await tabHistorial.click();
    await page.waitForLoadState("networkidle").catch(() => {});

    const filasMismoArchivo = page.getByText(/c16_archivo_duplicado\.xlsx/i);
    await expect(filasMismoArchivo.first()).toBeVisible({ timeout: 20_000 });
    const count = await filasMismoArchivo.count();
    expect(count).toBeGreaterThanOrEqual(2);

    await tomarCaptura(page, `c16-${prefix}-01-cargas-duplicadas.png`);
    expect(await verificarSinDesborde(page, "C16 Cargas Duplicadas")).toBeTruthy();
  });
});
