import { expect, test, type Page } from "@playwright/test";

import { iniciarSesionE2E } from "./credenciales";

/**
 * Enlace de activación del postulante (D-10), escritorio y teléfono (390x844).
 *
 * Cubre por la interfaz: el alta con «Enviar enlace por correo» (sin contraseña a la vista, correo enmascarado),
 * la opción deshabilitada sin correo, el «Reenviar enlace» y el historial del expediente, y los estados de error
 * de `/postulacion/activar` (sin token, token inventado) sin desbordes en el teléfono.
 *
 * El flujo feliz de la activación (abrir el enlace real, cédula + contraseña, sesión iniciada) NO se prueba aquí:
 * el token solo existe en el correo y en la base se guarda su hash. Está cubierto de punta a punta en pytest
 * (`tests/integration/postulacion/test_enlace_activacion_api.py`). Para probarlo en vivo, ver al final de este archivo.
 * Los correos usan el dominio reservado `.invalid`: nunca llegan a nadie.
 */
const VISTAS = [
  { nombre: "escritorio", viewport: { width: 1280, height: 800 } },
  { nombre: "móvil 390x844", viewport: { width: 390, height: 844 } },
] as const;

function cedulaAleatoria(): string {
  return `17${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
}

async function esperarHidratacion(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
}

async function sinDesborde(page: Page) {
  const desborda = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(desborda, "la página no debe desbordar en horizontal").toBe(false);
}

for (const { nombre, viewport } of VISTAS) {
  test(`captación: alta con enlace por correo, reenvío e historial (${nombre})`, async ({ browser }) => {
    test.setTimeout(180_000);
    const contexto = await browser.newContext({ viewport });
    const page = await contexto.newPage();
    page.setDefaultTimeout(30_000);

    try {
      await iniciarSesionE2E(page);
      await page.goto("/captacion/expedientes");
      await esperarHidratacion(page);

      // 1. Sin correo, el envío por correo está deshabilitado y se explica por qué.
      const cedula = cedulaAleatoria();
      await page.getByRole("button", { name: /nuevo postulante/i }).click();
      const dialogo = page.getByRole("dialog");
      const radioCorreo = dialogo.getByRole("radio", { name: /enviar enlace por correo/i });
      await expect(radioCorreo).toBeDisabled();
      await expect(dialogo.getByTestId("entrega-sin-correo")).toBeVisible();

      // 2. Con correo se habilita, muestra el destino y el recordatorio destacado.
      await dialogo.getByLabel(/cédula de identidad/i).fill(cedula);
      await dialogo.getByLabel(/nombres/i).fill("Prueba");
      await dialogo.getByLabel(/apellidos/i).fill("Activacion Enlace");
      await dialogo.getByLabel(/correo \(opcional\)/i).fill(`activacion.${cedula}@ejemplo.invalid`);
      await expect(radioCorreo).toBeEnabled();
      await expect(dialogo.getByText(/confirma el correo con la persona antes de enviar/i)).toBeVisible();
      await radioCorreo.check();
      await expect(radioCorreo).toBeChecked();
      await dialogo.getByRole("button", { name: /crear y enviar enlace/i }).click();

      // 3. Confirmación: correo enmascarado, vencimiento y NINGUNA contraseña.
      await expect(dialogo.getByTestId("enlace-enviado")).toContainText(/enlace enviado a ac\*\*\*@ejemplo\.invalid, vence el/i);
      await expect(dialogo.getByTestId("credencial-clave")).toHaveCount(0);
      await expect(dialogo.getByText(`activacion.${cedula}@ejemplo.invalid`)).toHaveCount(0);
      await dialogo.getByRole("button", { name: /entendido/i }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      // 4. El detalle muestra el último enlace y permite reenviarlo.
      await page.reload();
      await esperarHidratacion(page);
      await page.getByRole("tab", { name: /todos/i }).click();
      await page.getByLabel(/buscar por cédula/i).fill(cedula);
      const fila = viewport.width >= 768 ? page.getByRole("row").filter({ hasText: cedula }) : page.getByRole("link").filter({ hasText: cedula });
      await expect(fila).toHaveCount(1, { timeout: 30_000 });
      await (viewport.width >= 768 ? fila.getByRole("link") : fila).click();
      await page.waitForURL(/\/captacion\/expedientes\/[0-9a-f-]{36}/);
      await esperarHidratacion(page);
      await expect(page.getByTestId("estado-enlace")).toContainText(/ac\*\*\*@ejemplo\.invalid/);
      await expect(page.getByTestId("estado-enlace")).toContainText(/esperando que lo use/i);

      await page.getByRole("button", { name: /reenviar enlace/i }).click();
      const reenvio = page.getByRole("alertdialog");
      await expect(reenvio.getByRole("radio", { name: /enviar enlace por correo/i })).toBeChecked();
      await expect(reenvio.getByText(/confirma el correo con la persona antes de enviar/i)).toBeVisible();
      await reenvio.getByRole("button", { name: /enviar enlace/i }).click();
      await expect(page.getByTestId("enlace-enviado")).toContainText(/ac\*\*\*@ejemplo\.invalid/);
      await page.getByRole("button", { name: /entendido/i }).click();

      // 5. Queda en el historial con el correo enmascarado (dos envíos).
      await page.getByRole("tab", { name: /historial/i }).click();
      await expect(page.getByText(/enlace de acceso enviado a ac\*\*\*@ejemplo\.invalid/i)).toHaveCount(2);
      await expect(page.getByText(`activacion.${cedula}@ejemplo.invalid`)).toHaveCount(0);
    } finally {
      await contexto.close();
    }
  });

  test(`postulante: la página /postulacion/activar muestra errores amables (${nombre})`, async ({ browser }) => {
    const contexto = await browser.newContext({ viewport });
    const page = await contexto.newPage();
    page.setDefaultTimeout(30_000);

    try {
      // Sin token y con un token inventado: mismo mensaje, sin sesión y sin revelar nada.
      for (const ruta of ["/postulacion/activar", `/postulacion/activar?t=${"x".repeat(43)}`]) {
        await page.goto(ruta);
        await expect(page).toHaveURL(/\/postulacion\/activar/);
        const aviso = page.getByTestId("enlace-no-disponible");
        await expect(aviso).toBeVisible();
        await expect(aviso).toHaveAttribute("data-codigo", "ENLACE_INVALIDO");
        await expect(page.getByRole("heading", { name: /este enlace no es válido/i })).toBeVisible();
        await expect(page.getByText("Pide a Captación un enlace nuevo.")).toBeVisible();
        await expect(page.getByLabel(/cédula de identidad/i)).toHaveCount(0);
        await sinDesborde(page);
      }
      await page.getByRole("link", { name: /ir al acceso del postulante/i }).click();
      await expect(page).toHaveURL(/\/postulacion\/acceso/);
    } finally {
      await contexto.close();
    }
  });
}

test("postulante: el aviso «Tu contraseña quedó creada» aparece en el acceso", async ({ page }) => {
  await page.goto("/postulacion/acceso?motivo=creada");
  await expect(page.getByTestId("aviso-contrasena-creada")).toContainText(/tu contraseña quedó creada/i);
});

/*
 * CÓMO PROBAR EN VIVO EL FLUJO FELIZ (auditor), sin tocar el código:
 *  1. En la UI de Captación: «Nuevo postulante» con un correo `@ejemplo.invalid` y «Enviar enlace por correo».
 *  2. El correo sale por el outbox (no llega a nadie). Lea el enlace de la base de desarrollo:
 *       SELECT payload->>'enlace' FROM notificaciones_evento_outbox
 *        WHERE tipo = 'POSTULACION_ACTIVACION' ORDER BY created_at DESC LIMIT 1;
 *     (da `/postulacion/activar?t=<token>`; antepóngale la URL del frontend de desarrollo).
 *     OJO: el token solo se puede leer mientras el correo está PENDIENTE. Al enviarse (o al fallar definitivo) el
 *     sistema reemplaza el enlace por `[retirado]` en el outbox. En desarrollo, si el worker de Celery ya lo envió,
 *     no habrá token que leer: use el flujo de pytest (`test_enlace_activacion_api.py`) o lea el enlace antes del envío
 *     (p. ej. con el worker detenido).
 *  3. Ábralo: debe mostrar «Crea tu contraseña» con el número de postulación. Escriba la cédula del postulante y una
 *     contraseña nueva (10+ caracteres, letras y números, sin la cédula): entra directo a su formulario.
 *  4. Reabrir el mismo enlace: «Este enlace ya se usó». Con otra cédula: «No pudimos verificar tus datos» y, al quinto
 *     intento, «Este enlace se bloqueó». En la base solo existe el hash:
 *       SELECT token_hash, usado_el, ip_uso, intentos FROM postulacion_enlace_activacion ORDER BY creado_el DESC LIMIT 3;
 */
