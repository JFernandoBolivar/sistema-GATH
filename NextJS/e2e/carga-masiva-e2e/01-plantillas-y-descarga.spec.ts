import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { iniciarSesion, tomarCaptura, verificarSinDesborde } from "./helpers";

test.describe("Flujo: Descarga y Validación de Plantillas Excel", () => {
  test("Descarga y estructura de plantilla para Activos", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    await iniciarSesion(page);
    await page.goto("/personal/carga-masiva");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Captura inicial del paso 1
    await tomarCaptura(page, `plantilla-${prefix}-paso1-activos.png`);
    const sinDesbordePaso1 = await verificarSinDesborde(page, "Paso 1 Plantilla Activos");
    expect(sinDesbordePaso1).toBeTruthy();

    // Validar botón de descargar plantilla
    const botonDescargar = page.getByRole("button", { name: /descargar plantilla/i });
    await expect(botonDescargar).toBeVisible();

    // Descargar archivo interceptando el evento download
    const downloadPromise = page.waitForEvent("download");
    await botonDescargar.click();
    const download = await downloadPromise;

    const rutaDescarga = path.resolve(__dirname, `fixtures/descargada_activos_${prefix}.xlsx`);
    await download.saveAs(rutaDescarga);
    expect(fs.existsSync(rutaDescarga)).toBeTruthy();
    expect(fs.statSync(rutaDescarga).size).toBeGreaterThan(1000);

    // Validar con python openpyxl que abre y tiene las columnas
    const scriptPath = path.resolve(__dirname, "validar_excel.py");
    const res = execSync(`python "${scriptPath}" "${rutaDescarga}" ACTIVOS`, { encoding: "utf-8" });
    expect(res).toContain("OK_ACTIVOS");
  });

  test("Descarga y estructura de plantilla para Pasivos", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    await iniciarSesion(page);
    await page.goto("/pasivos/carga-masiva");
    await page.waitForLoadState("networkidle").catch(() => {});

    await tomarCaptura(page, `plantilla-${prefix}-paso1-pasivos.png`);
    const sinDesborde = await verificarSinDesborde(page, "Paso 1 Plantilla Pasivos");
    expect(sinDesborde).toBeTruthy();

    const botonDescargar = page.getByRole("button", { name: /descargar plantilla/i });
    await expect(botonDescargar).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await botonDescargar.click();
    const download = await downloadPromise;

    const rutaDescarga = path.resolve(__dirname, `fixtures/descargada_pasivos_${prefix}.xlsx`);
    await download.saveAs(rutaDescarga);
    expect(fs.existsSync(rutaDescarga)).toBeTruthy();
    expect(fs.statSync(rutaDescarga).size).toBeGreaterThan(1000);

    const scriptPath = path.resolve(__dirname, "validar_excel.py");
    const res = execSync(`python "${scriptPath}" "${rutaDescarga}" PASIVOS`, { encoding: "utf-8" });
    expect(res).toContain("OK_PASIVOS");
  });
});
