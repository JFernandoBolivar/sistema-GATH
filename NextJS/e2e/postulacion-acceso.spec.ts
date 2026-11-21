import { expect, test, type Browser, type Page } from "@playwright/test";

import { iniciarSesionE2E } from "./credenciales";

/**
 * Portal del postulante (D-5/D-6): sesión de invitado, cambio obligatorio de clave, expediente,
 * borrador y envío a Captación. Se corre en escritorio y en teléfono (390x844).
 *
 * El postulante se crea antes por API como Captación (el admin E2E): la clave temporal sale en la
 * respuesta y es la única vez que se muestra.
 */
const DJANGO = process.env.E2E_DJANGO_URL ?? "http://127.0.0.1:8001";

const VISTAS = [
  { nombre: "escritorio", viewport: { width: 1280, height: 800 } },
  { nombre: "móvil 390x844", viewport: { width: 390, height: 844 } },
] as const;

function cedulaAleatoria(): string {
  return `18${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
}

async function crearPostulante(browser: Browser): Promise<{ cedula: string; claveTemporal: string }> {
  const contexto = await browser.newContext();
  try {
    const admin = await contexto.newPage();
    await iniciarSesionE2E(admin);
    const token = (await contexto.cookies()).find((c) => c.name === "dj_access")?.value;
    expect(token, "el admin E2E debe tener sesión").toBeTruthy();
    const cedula = cedulaAleatoria();
    const respuesta = await admin.request.post(`${DJANGO}/api/v1/postulacion/postulantes/`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { cedula, nombres: "Prueba", apellidos: "Postulante Auditoria" },
    });
    expect(respuesta.ok(), `crear postulante: HTTP ${respuesta.status()}`).toBeTruthy();
    const cuerpo = (await respuesta.json()) as { data?: { credencial?: { clave_temporal?: string } } };
    const claveTemporal = cuerpo.data?.credencial?.clave_temporal ?? "";
    expect(claveTemporal, "la respuesta trae la clave temporal").not.toBe("");
    return { cedula, claveTemporal };
  } finally {
    await contexto.close();
  }
}

async function esperarHidratacion(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
}

for (const { nombre, viewport } of VISTAS) {
  test(`postulante: acceso, cambio de clave, borrador y envío (${nombre})`, async ({ browser }) => {
    test.setTimeout(120_000);
    const { cedula, claveTemporal } = await crearPostulante(browser);
    const claveNueva = "Clave2026Segura";

    const contexto = await browser.newContext({ viewport });
    const page = await contexto.newPage();
    page.setDefaultTimeout(30_000);

    try {
      // 1. Contraseña incorrecta: mensaje genérico y claro.
      await page.goto("/postulacion/acceso");
      await esperarHidratacion(page);
      await page.getByLabel("Cédula de identidad").fill(cedula);
      await page.getByLabel("Contraseña", { exact: true }).fill("ClaveIncorrecta99");
      await page.getByRole("button", { name: "Ingresar" }).click();
      await expect(page.getByText(/la cédula o la contraseña no son correctas/i)).toBeVisible();

      // 2. Entra con la clave temporal: el cambio de clave es obligatorio.
      await page.getByLabel("Contraseña", { exact: true }).fill(claveTemporal);
      await page.getByRole("button", { name: "Ingresar" }).click();
      await page.waitForURL(/\/postulacion\/cambiar-clave/);

      // Sin cambiar la clave no se llega al inicio del área.
      await page.goto("/postulacion");
      await expect(page).toHaveURL(/\/postulacion\/cambiar-clave/);

      // 3. Reglas en vivo y cambio de clave.
      await esperarHidratacion(page);
      await page.getByLabel("Contraseña temporal", { exact: true }).fill(claveTemporal);
      await page.getByLabel("Contraseña nueva", { exact: true }).fill("corta1");
      await expect(page.getByText("Al menos 10 caracteres").locator("..")).not.toContainText("(cumple)");
      await page.getByLabel("Contraseña nueva", { exact: true }).fill(claveNueva);
      await expect(page.getByText("Al menos 10 caracteres").locator("..")).toContainText("(cumple)");
      await page.getByLabel("Repite la contraseña nueva", { exact: true }).fill(claveNueva);
      await page.getByRole("button", { name: /guardar y continuar/i }).click();
      await page.waitForURL((u) => u.pathname === "/postulacion");

      // 4. Expediente en «En captura», con layout propio (sin menú del personal).
      await expect(page.getByRole("heading", { name: /hola, prueba/i })).toBeVisible();
      await expect(page.getByText("En captura").first()).toBeVisible();
      await expect(page.getByRole("button", { name: /salir/i })).toBeVisible();
      await expect(page.getByRole("navigation", { name: /avance de tu postulación/i })).toBeVisible();

      // El postulante no abre rutas del personal.
      await page.goto("/carnetizacion");
      await expect(page).toHaveURL((u) => u.pathname === "/postulacion");

      // 5. Enviar sin los datos obligatorios no avanza y lo explica.
      await esperarHidratacion(page);
      await page.getByRole("button", { name: /enviar a captación/i }).click();
      await expect(page.getByText(/completa los datos marcados con asterisco/i)).toBeVisible();
      await expect(page.getByRole("alertdialog")).toHaveCount(0);

      // 6. Guardar borrador.
      await page.getByLabel(/fecha de nacimiento/i).fill("1995-04-12");
      await page.getByRole("radio", { name: /femenino/i }).click();
      await page.getByRole("button", { name: /guardar avance/i }).click();
      await expect(page.getByText(/avance guardado a las/i)).toBeVisible();

      // El borrador persiste al recargar.
      await page.reload();
      await esperarHidratacion(page);
      await expect(page.getByLabel(/fecha de nacimiento/i)).toHaveValue("1995-04-12");

      // 7. Enviar con confirmación → «Recibido» y sesión cerrada.
      await page.getByRole("button", { name: /enviar a captación/i }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await page.getByRole("button", { name: /sí, enviar/i }).click();
      await page.waitForURL(/\/postulacion\/recibido/);
      await expect(page.getByRole("heading", { name: /recibimos tu información/i })).toBeVisible();
      await expect(page.getByText(/tu sesión se cerró/i)).toBeVisible();

      await page.goto("/postulacion");
      await expect(page).toHaveURL(/\/postulacion\/acceso/);
    } finally {
      await contexto.close();
    }
  });
}
