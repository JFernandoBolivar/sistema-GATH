import { expect, test, type Page } from "@playwright/test";
import { deflateSync } from "node:zlib";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * Fe de vida (C10-C18). Credenciales solo por entorno (R15):
 *  - PASIVO (condición PASIVO, permiso fe_de_vida.solicitar): E2E_PASIVO_EMAIL / E2E_PASIVO_PASSWORD.
 *  - BIENESTAR (analista o administradora con fe_de_vida.revisar): E2E_BIEN_EMAIL / E2E_BIEN_PASSWORD.
 * Requiere un proceso de fe de vida ABIERTO que alcance al pasivo de prueba. Un perfil sin
 * credenciales se omite. La cámara se simula con los flags de Chromium para medios falsos.
 */
const PASIVO_EMAIL = process.env.E2E_PASIVO_EMAIL;
const PASIVO_PASSWORD = process.env.E2E_PASIVO_PASSWORD;
const BIEN_EMAIL = process.env.E2E_BIEN_EMAIL;
const BIEN_PASSWORD = process.env.E2E_BIEN_PASSWORD;

/** PNG gris válido de 600x600 (el servidor exige al menos 480 px por lado) para la subida de archivo. */
function pngGris(lado: number): Buffer {
  const crcTabla = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTabla[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const trozo = (tipo: string, datos: Buffer) => {
    const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const suma = Buffer.alloc(4);
    suma.writeUInt32BE(crc(cuerpo));
    return Buffer.concat([largo, cuerpo, suma]);
  };
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(lado, 0);
  cabecera.writeUInt32BE(lado, 4);
  cabecera[8] = 8; // 8 bits, escala de grises
  const filas = Buffer.alloc((lado + 1) * lado, 0x80); // cada fila: filtro 0 + píxeles
  for (let y = 0; y < lado; y++) filas[y * (lado + 1)] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", cabecera),
    trozo("IDAT", deflateSync(filas)),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}
const PNG_FOTO = pngGris(600);

// La cámara falsa debe declararse a nivel de archivo: Playwright no admite `launchOptions` dentro de un describe.
test.use({
  permissions: ["camera"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

async function recorrerHastaLaFoto(page: Page): Promise<void> {
  await page.goto("/autogestion/fe-de-vida");
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  const comenzar = page.getByRole("button", { name: /comenzar mi fe de vida|corregir y reenviar/i });
  // Si ya hay un borrador no aparece el botón: se espera un instante a que la página decida cuál mostrar.
  const hayComenzar = await comenzar.waitFor({ state: "visible", timeout: 8_000 }).then(() => true).catch(() => false);
  if (hayComenzar) await comenzar.click();
  // La solicitud del pasivo de prueba ya fue enviada (una corrida previa): para repetir, Bienestar debe devolverla.
  test.skip(
    await page.getByText(/bienestar social está revisando su fe de vida|validada \(completado\)/i).first().isVisible().catch(() => false),
    "La solicitud del pasivo de prueba ya está enviada o validada; devuélvala desde Bienestar para repetir el recorrido",
  );
  await expect(page.getByRole("heading", { name: /sus datos registrados/i })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/teléfono celular/i).fill("0412-1234567");
  await page.getByLabel(/no tengo hijos/i).check();
  await page.getByRole("button", { name: /^continuar/i }).click();
  await expect(page.getByRole("heading", { name: /contacto de emergencia y dirección/i })).toBeVisible();
  await page.getByRole("button", { name: /^continuar/i }).click();
  await expect(page.getByRole("heading", { name: /foto con su cédula/i })).toBeVisible();
}

test.describe("Fe de vida del pasivo: archivo inválido", () => {
  test.skip(!PASIVO_EMAIL || !PASIVO_PASSWORD, "Faltan E2E_PASIVO_EMAIL / E2E_PASIVO_PASSWORD");

  test("rechaza un archivo que no es una foto y no permite continuar", async ({ page }) => {
    await iniciarSesionComo(page, PASIVO_EMAIL!, PASIVO_PASSWORD!);
    await recorrerHastaLaFoto(page);
    await page.getByRole("button", { name: /^subir foto$/i }).click();
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "documento.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 no es una imagen"),
    });
    await expect(page.getByText(/la foto debe ser un archivo jpg o png/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^continuar/i })).toBeDisabled();
  });
});

test.describe("Fe de vida del pasivo con cámara falsa", () => {
  test.skip(!PASIVO_EMAIL || !PASIVO_PASSWORD, "Faltan E2E_PASIVO_EMAIL / E2E_PASIVO_PASSWORD");

  test("completa datos y foto por cámara hasta la pantalla de revisión", async ({ page }) => {
    await iniciarSesionComo(page, PASIVO_EMAIL!, PASIVO_PASSWORD!);
    await recorrerHastaLaFoto(page);
    await page.getByRole("button", { name: /tomar foto/i }).click();
    await expect(page.getByLabel(/vista en vivo de la cámara/i)).toBeVisible();
    await page.getByRole("button", { name: /capturar foto/i }).click();
    await expect(page.getByRole("button", { name: /repetir foto/i })).toBeVisible();
    await page.getByRole("button", { name: /^continuar/i }).click();
    await expect(page.getByRole("heading", { name: /revise y envíe/i })).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("Fe de vida del pasivo: envío con subida de archivo", () => {
  test.skip(!PASIVO_EMAIL || !PASIVO_PASSWORD, "Faltan E2E_PASIVO_EMAIL / E2E_PASIVO_PASSWORD");
  // Es la única prueba que envía: deja la solicitud pendiente de revisión para la prueba de Bienestar.

  test("sube una foto desde el equipo y envía la fe de vida", async ({ page }) => {
    await iniciarSesionComo(page, PASIVO_EMAIL!, PASIVO_PASSWORD!);
    await recorrerHastaLaFoto(page);
    await page.getByRole("button", { name: /^subir foto$/i }).click();
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "cedula.png",
      mimeType: "image/png",
      buffer: PNG_FOTO,
    });
    await page.getByRole("button", { name: /^continuar/i }).click();
    await expect(page.getByRole("heading", { name: /revise y envíe/i })).toBeVisible({ timeout: 30_000 });
    await page.getByLabel(/declaro que los datos/i).check();
    await page.getByRole("button", { name: /enviar fe de vida/i }).click();
    await expect(page.getByText(/bienestar social está revisando su fe de vida/i)).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("Revisión de Bienestar", () => {
  test.skip(!BIEN_EMAIL || !BIEN_PASSWORD, "Faltan E2E_BIEN_EMAIL / E2E_BIEN_PASSWORD");

  test("la bandeja filtra y el detalle muestra la foto y los botones por permiso", async ({ page }) => {
    await iniciarSesionComo(page, BIEN_EMAIL!, BIEN_PASSWORD!);
    await page.goto("/personal/fe-de-vida");
    await expect(page.getByRole("heading", { name: /fe de vida del personal pasivo/i })).toBeVisible();
    await page.getByLabel(/^estado$/i).selectOption("PENDIENTE_REVISION");
    await page.getByRole("button", { name: /buscar/i }).click();
    await expect(
      page.getByRole("status").filter({ hasText: /mostrando/i }).or(page.getByText(/no hay solicitudes/i)),
    ).toBeVisible({ timeout: 30_000 });

    const abrir = page.getByRole("link", { name: /abrir la fe de vida de/i }).first();
    test.skip(!(await abrir.isVisible().catch(() => false)), "No hay solicitudes pendientes de revisión");
    await abrir.click();
    await expect(page.getByRole("heading", { name: /foto con la cédula/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /ampliar/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /datos propuestos por el pasivo/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /devolver para corrección/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /rechazar/i })).toBeVisible();

    // Devolver exige motivo.
    await page.getByRole("button", { name: /devolver para corrección/i }).click();
    await page.getByRole("button", { name: /^devolver$/i }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel(/requiere una foto nueva/i)).toBeVisible();
  });

  test("procesos y cobertura cargan con sus filtros", async ({ page }) => {
    await iniciarSesionComo(page, BIEN_EMAIL!, BIEN_PASSWORD!);
    await page.goto("/personal/fe-de-vida/cobertura");
    await expect(page.getByRole("heading", { name: /cobertura de pasivos/i })).toBeVisible();
    await page.getByLabel(/sin correo/i).check();
    await page.getByRole("button", { name: /buscar/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /mostrando/i }).or(page.getByText(/sin resultados/i))).toBeVisible({ timeout: 30_000 });
  });
});
