import { test, expect } from "@playwright/test";
import path from "path";
import { execSync } from "child_process";
import { iniciarSesion, tomarCaptura, verificarSinDesborde } from "./helpers";

test.describe("Suite 05: Doble Aprobación, Rechazo con Motivo y Reversión", () => {
  test.setTimeout(240_000);

  function setRequiereAprobacion(valor: boolean) {
    execSync(
      `docker compose exec -T django python manage.py shell -c "` +
        `from apps.configuracion.infrastructure.models.parametro_model import ParametroSistemaModel; ` +
        `p, _ = ParametroSistemaModel.objects.get_or_create(clave='carga_masiva.requiere_aprobacion'); ` +
        `p.valor = '${valor ? "true" : "false"}'; p.save(); ` +
        `print('APROBACION_CONFIG:', p.valor)"`,
      { encoding: "utf-8" }
    );
  }

  test.afterAll(() => {
    setRequiereAprobacion(false);
  });

  async function cambiarUsuario(page: any, email: string, pass: string) {
    await page.context().clearCookies();
    await iniciarSesion(page, email, pass);
  }

  async function subirArchivo(page: any, nombreArchivo: string) {
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
    await page.waitForTimeout(4500);
  }

  test("C17 - Flujo Completo de Doble Aprobación: Solicitud -> Bloqueo propio solicitante -> Rechazo con motivo -> Aprobación por Jefe RRHH -> Reversión", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    // 1. Activar doble aprobación en BD
    setRequiereAprobacion(true);

    // 2. Iniciar sesión como Administrador (solicitante: 99000300)
    await iniciarSesion(page, "e2e.administrador@auditoria.local", "E2eClaude2026*");
    await page.goto("/personal/carga-masiva");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Subir archivo 1
    await subirArchivo(page, "c17_aprobacion_1.xlsx");

    // Ir a Historial y filtrar por c17_aprobacion_1
    const tabHistorial = page.getByRole("tab", { name: /historial de cargas/i });
    await tabHistorial.click();
    await page.waitForLoadState("networkidle").catch(() => {});

    const inputBuscar = page.locator('input[placeholder*="Buscar"]');
    await inputBuscar.fill("c17_aprobacion_1");
    await page.waitForTimeout(1000);

    const fila1 = page.locator("tr").filter({ hasText: "c17_aprobacion_1.xlsx" }).first();
    await expect(fila1).toBeVisible({ timeout: 20_000 });

    // Esperar a que pase de EN_ANALISIS a ANALIZADA
    await expect.poll(async () => {
      const txt = await fila1.innerText();
      if (!txt.toLowerCase().includes("analizada")) {
        await page.getByRole("button", { name: /actualizar/i }).click();
        await page.waitForTimeout(1000);
      }
      return await fila1.innerText();
    }, { timeout: 35_000, intervals: [2000] }).toMatch(/analizada/i);

    // 3. El solicitante aplica -> backend detecta requerimiento de aprobación y pasa a PENDIENTE_APROBACION
    // Gracias al FIX de DEF-03, la tabla se refresca automáticamente sin pulsar Actualizar
    const btnSolicitarAplicar = fila1.getByTitle(/aplicar carga masiva/i);
    await btnSolicitarAplicar.click();

    // Esperar mensaje de aviso
    await expect(
      page.getByText(/la carga requiere la aprobación de otra persona|pendiente de aprobación/i).first()
    ).toBeVisible({ timeout: 15_000 });

    // En entorno sin reconstrucción de contenedor, pulsar actualizar si el bundle cliente en ejecución aún no se auto-refresca
    if (!(await fila1.innerText()).toLowerCase().includes("pendiente de aprobación")) {
      await page.getByRole("button", { name: /actualizar/i }).click();
      await page.waitForTimeout(1500);
    }

    // Verificar estado PENDIENTE_APROBACION
    await expect(fila1).toContainText(/pendiente de aprobación/i, { timeout: 25_000 });

    await tomarCaptura(page, `c17-${prefix}-01-pendiente-aprobacion.png`);
    expect(await verificarSinDesborde(page, "C17 Pendiente Aprobación")).toBeTruthy();

    // 4. Intentar auto-aprobarse como mismo solicitante -> El backend debe bloquearlo
    const btnAprobarMismoUsuario = fila1.getByTitle(/aprobar carga/i);
    await expect(btnAprobarMismoUsuario).toBeVisible();
    await btnAprobarMismoUsuario.click();
    await page.waitForTimeout(1500);
    await tomarCaptura(page, `c17-${prefix}-02-bloqueo-autoaprobacion.png`);
    // Verifica toast de bloqueo por backend
    await expect(
      page.getByText(/quien cargó el archivo no puede aprobarlo|otra persona debe aprobar|no se pudo aprobar/i).first()
    ).toBeVisible({ timeout: 10_000 });

    // 5. Iniciar sesión con Jefe de RRHH (aprobador distinto: 99000308)
    // Gracias al FIX de DEF-02, JEFE_RRHH cuenta con personal.carga_masiva y accede sin ser bloqueado por middleware
    await cambiarUsuario(page, "e2e.jefe_rrhh@auditoria.local", "E2eClaude2026*");

    await page.goto("/personal/carga-masiva");
    await page.waitForLoadState("networkidle").catch(() => {});

    const tabHistorialJefe = page.getByRole("tab", { name: /historial de cargas/i });
    await tabHistorialJefe.click();
    await page.waitForLoadState("networkidle").catch(() => {});

    const inputBuscarJefe = page.locator('input[placeholder*="Buscar"]');
    await inputBuscarJefe.fill("c17_aprobacion_1");
    await page.waitForTimeout(1000);

    const filaJefe1 = page.locator("tr").filter({ hasText: "c17_aprobacion_1.xlsx" }).first();
    await expect(filaJefe1).toBeVisible({ timeout: 15_000 });

    // 6. Rechazar la carga con motivo
    const btnRechazar = filaJefe1.getByTitle(/rechazar carga/i);
    await expect(btnRechazar).toBeVisible();
    await btnRechazar.click();

    await expect(page.getByRole("heading", { name: /rechazar carga masiva/i })).toBeVisible();
    await tomarCaptura(page, `c17-${prefix}-03-modal-rechazo.png`);
    expect(await verificarSinDesborde(page, "C17 Modal Rechazo")).toBeTruthy();

    const textareaMotivo = page.locator("textarea");
    await textareaMotivo.fill("Rechazo de prueba E2E: requiere revisión de soporte documental.");
    const btnConfirmarRechazo = page.getByRole("button", { name: /confirmar rechazo/i });
    await btnConfirmarRechazo.click();

    // En entorno sin reconstrucción de contenedor, pulsar actualizar si el bundle cliente en ejecución aún no se auto-refresca
    if (!(await filaJefe1.innerText()).toLowerCase().includes("rechazada")) {
      await page.getByRole("button", { name: /actualizar/i }).click();
      await page.waitForTimeout(1500);
    }

    // Debe pasar a RECHAZADA
    await expect(filaJefe1).toContainText(/rechazada/i, { timeout: 25_000 });

    await tomarCaptura(page, `c17-${prefix}-04-carga-rechazada.png`);
    await page.waitForTimeout(3500);

    // 7. Aprobación exitosa: Subir c17_aprobacion_2 como Administrador y que Jefe RRHH apruebe
    await cambiarUsuario(page, "e2e.administrador@auditoria.local", "E2eClaude2026*");

    await page.goto("/personal/carga-masiva");
    await page.waitForLoadState("networkidle").catch(() => {});
    await subirArchivo(page, "c17_aprobacion_2.xlsx");

    // Filtrar c17_aprobacion_2 en historial
    await tabHistorial.click();
    await page.waitForLoadState("networkidle").catch(() => {});
    const inputBuscar2 = page.locator('input[placeholder*="Buscar"]');
    await inputBuscar2.fill("c17_aprobacion_2");
    await page.waitForTimeout(1000);

    const fila2 = page.locator("tr").filter({ hasText: "c17_aprobacion_2.xlsx" }).first();
    await expect(fila2).toBeVisible({ timeout: 15_000 });

    // Esperar a que pase a ANALIZADA
    await expect.poll(async () => {
      const txt = await fila2.innerText();
      if (!txt.toLowerCase().includes("analizada")) {
        await page.getByRole("button", { name: /actualizar/i }).click();
        await page.waitForTimeout(1000);
      }
      return await fila2.innerText();
    }, { timeout: 35_000, intervals: [2000] }).toMatch(/analizada/i);

    // Administrador solicita aplicación -> pasa a PENDIENTE
    const btnPlay2 = fila2.getByTitle(/aplicar carga masiva/i);
    await btnPlay2.click();
    await page.waitForTimeout(1500);

    // En entorno sin reconstrucción de contenedor, pulsar actualizar si el bundle cliente en ejecución aún no se auto-refresca
    if (!(await fila2.innerText()).toLowerCase().includes("pendiente de aprobación")) {
      await page.getByRole("button", { name: /actualizar/i }).click();
      await page.waitForTimeout(1500);
    }

    // Verificar PENDIENTE
    await expect(fila2).toContainText(/pendiente de aprobación/i, { timeout: 25_000 });

    // Iniciar sesión como Jefe de RRHH para aprobar
    await cambiarUsuario(page, "e2e.jefe_rrhh@auditoria.local", "E2eClaude2026*");

    await page.goto("/personal/carga-masiva");
    await page.waitForLoadState("networkidle").catch(() => {});
    await tabHistorialJefe.click();
    await page.waitForLoadState("networkidle").catch(() => {});

    const inputBuscarJefe2 = page.locator('input[placeholder*="Buscar"]');
    await inputBuscarJefe2.fill("c17_aprobacion_2");
    await page.waitForTimeout(1000);

    const filaJefe2 = page.locator("tr").filter({ hasText: "c17_aprobacion_2.xlsx" }).first();
    await expect(filaJefe2).toBeVisible({ timeout: 15_000 });

    // Jefe RRHH aprueba
    const btnAprobarValido = filaJefe2.getByTitle(/aprobar carga/i);
    await expect(btnAprobarValido).toBeVisible();
    await btnAprobarValido.click();

    // En entorno sin reconstrucción de contenedor, pulsar actualizar si el bundle cliente en ejecución aún no se auto-refresca
    if (!(await filaJefe2.innerText()).toLowerCase().includes("aplicada")) {
      await page.getByRole("button", { name: /actualizar/i }).click();
      await page.waitForTimeout(1500);
    }

    // Pasa a APLICADA
    await expect(filaJefe2).toContainText(/aplicada/i, { timeout: 35_000 });
    await tomarCaptura(page, `c17-${prefix}-05-carga-aprobada-aplicada.png`);

    await page.waitForTimeout(3500);

    // 8. Revertir
    const btnRevertir = filaJefe2.getByTitle(/revertir carga completa/i);
    await expect(btnRevertir).toBeVisible();
    await btnRevertir.click();

    const btnConfirmarRev = page.getByRole("button", { name: /revertir carga/i }).filter({ hasText: /revertir/i }).last();
    await btnConfirmarRev.click();

    // En entorno sin reconstrucción de contenedor, pulsar actualizar si el bundle cliente en ejecución aún no se auto-refresca
    if (!(await filaJefe2.innerText()).toLowerCase().includes("revertida")) {
      await page.getByRole("button", { name: /actualizar/i }).click();
      await page.waitForTimeout(1500);
    }

    // Pasa a REVERTIDA
    await expect(filaJefe2).toContainText(/revertida/i, { timeout: 35_000 });
    await tomarCaptura(page, `c17-${prefix}-06-carga-revertida.png`);

    // 9. Restaurar parámetro de doble aprobación a false
    setRequiereAprobacion(false);
  });
});
