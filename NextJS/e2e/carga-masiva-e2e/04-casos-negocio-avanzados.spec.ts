import { test, expect } from "@playwright/test";
import path from "path";
import { execSync } from "child_process";
import { iniciarSesion, tomarCaptura, verificarSinDesborde } from "./helpers";

test.describe("Suite 04: Casos de Negocio Avanzados", () => {
  test.beforeAll(() => {
    // Asegurar que el titular 88007001 existe para el caso de familiares C14
    execSync(
      'docker compose exec -T django python manage.py shell -c "' +
        'from apps.personal.infrastructure.models.personal_models import EmployeeModel; ' +
        'from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel; ' +
        'nac = NacionalidadModel.objects.first(); ' +
        'sex = SexoModel.objects.first(); ' +
        'EmployeeModel.objects.get_or_create(cedulaidentidad=\'88007001\', defaults={\'nombres\': \'TITULAR\', \'apellidos\': \'FAMILIAR\', \'nacionalidad\': nac, \'sexoid\': sex})"',
      { encoding: "utf-8" }
    );
  });

  // Helper para subir archivo en el Asistente
  async function subirArchivo(page: any, rutaRelativa: string) {
    const btnListo = page.getByRole("button", { name: /ya tengo el archivo listo/i });
    if (await btnListo.isVisible()) {
      await btnListo.click();
    }
    const rutaArchivo = path.resolve(__dirname, `fixtures/${rutaRelativa}`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(rutaArchivo);
    const btnAnalizar = page.getByRole("button", { name: /analizar archivo/i });
    await expect(btnAnalizar).toBeEnabled();
    await btnAnalizar.click();
    // Espaciar subidas para no agotar el throttle de 20/min.
    await page.waitForTimeout(8000);
  }

  test("C11 - Archivo grande (~1000 filas sintéticas) y medición de rendimiento", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    await iniciarSesion(page);
    await page.goto("/personal/carga-masiva");
    await page.waitForLoadState("networkidle").catch(() => {});

    const inicio = Date.now();
    await subirArchivo(page, "c11_archivo_1000_filas.xlsx");

    // Con 1000 filas el análisis toma ~6-8 segundos
    await page.waitForTimeout(6500);
    const fin = Date.now();
    const duracionSegundos = ((fin - inicio) / 1000).toFixed(2);
    console.log(`[C11 RENDIMIENTO ${prefix.toUpperCase()}] Tiempo de subida y análisis de 1000 filas: ${duracionSegundos}s`);

    await tomarCaptura(page, `c11-${prefix}-01-analisis-1000-filas.png`);
    expect(await verificarSinDesborde(page, "C11 Subida 1000 filas")).toBeTruthy();

    // Ir a Historial y verificar que se analizaron las 1000 filas
    const tabHistorial = page.getByRole("tab", { name: /historial de cargas/i });
    await tabHistorial.click();
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(page.getByText(/c11_archivo_1000_filas\.xlsx/i).first()).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText(/1000/i).first()).toBeVisible();

    await tomarCaptura(page, `c11-${prefix}-02-historial-1000-filas.png`);
    expect(await verificarSinDesborde(page, "C11 Historial 1000 filas")).toBeTruthy();
    await page.waitForTimeout(3000);
  });

  test("C12 - Cédula de la otra población (Pasivo cargado en Activos sin reingreso)", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    await iniciarSesion(page);
    await page.goto("/personal/carga-masiva");
    await page.waitForLoadState("networkidle").catch(() => {});

    await subirArchivo(page, "c12_cedula_otra_poblacion.xlsx");
    await page.waitForTimeout(4500);

    const tabHistorial = page.getByRole("tab", { name: /historial de cargas/i });
    await tabHistorial.click();
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(page.getByText(/c12_cedula_otra_poblacion\.xlsx/i).first()).toBeVisible({ timeout: 20_000 });
    // Esperar a que el badge sea ANALIZADA antes de abrir el modal
    await expect(page.getByText(/analizada/i).first()).toBeVisible({ timeout: 15_000 });

    const btnVerDetalle = page.getByTitle(/ver detalle de filas/i).first();
    await btnVerDetalle.click();

    await expect(page.getByRole("heading", { name: /detalle de carga/i })).toBeVisible({ timeout: 10_000 });
    await tomarCaptura(page, `c12-${prefix}-01-otra-poblacion.png`);
    expect(await verificarSinDesborde(page, "C12 Detalle Otra Población")).toBeTruthy();

    // Debe mostrar advertencia clara de cambio de condición o datos faltantes
    await expect(page.getByText(/cambio de condición|faltan datos del movimiento/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(3000);
  });

  test("C13 - Cambio de condición: Requiere confirmación -> Confirmar -> Aplicar movimiento -> Revertir", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    await iniciarSesion(page);
    await page.goto("/pasivos/carga-masiva");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Subir c13_cambio_condicion.xlsx (Activo que pasa a Pasivo con todos los datos)
    await subirArchivo(page, "c13_cambio_condicion.xlsx");
    await page.waitForTimeout(4500);

    const tabHistorial = page.getByRole("tab", { name: /historial de cargas/i });
    await tabHistorial.click();
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(page.getByText(/c13_cambio_condicion\.xlsx/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/analizada/i).first()).toBeVisible({ timeout: 15_000 });

    // 1. Verificar que inicialmente muestra 0/1 confirmadas
    await expect(page.getByText(/0\/1 confirmadas/i).first()).toBeVisible();
    await tomarCaptura(page, `c13-${prefix}-01-sin-confirmar.png`);
    expect(await verificarSinDesborde(page, "C13 Sin Confirmar")).toBeTruthy();

    // 2. Comprobar que el botón Aplicar está DESHABILITADO porque requiere confirmación
    const btnAplicarDisabled = page.getByTitle(/confirme las filas de cambio de condición antes de aplicar/i).first();
    await expect(btnAplicarDisabled).toBeVisible();
    await expect(btnAplicarDisabled).toBeDisabled();

    // 3. Confirmar la fila administrativamente con cédula válida (longitud <= 15)
    execSync(
      'docker compose exec -T django python manage.py shell -c "' +
        'from apps.carga_masiva.application.use_cases.gestionar_carga import confirmar_filas; ' +
        'from apps.carga_masiva.infrastructure.adaptadores import AplicadorCargaORM; ' +
        'from apps.carga_masiva.infrastructure.models import CargaMasivaModel; ' +
        'carga = CargaMasivaModel.objects.filter(archivo_nombre__contains=\'c13\').order_by(\'-pk\').first(); ' +
        'fila_ids = list(carga.filas.filter(estado=\'REQUIERE_CONFIRMACION\').values_list(\'pk\', flat=True)); ' +
        'confirmar_filas(carga, fila_ids, \'99000100\', AplicadorCargaORM()); ' +
        'print(\'CONFIRMADAS:\', carga.filas_confirmadas)"',
      { encoding: "utf-8" }
    );

    // 4. Refrescar el historial y verificar que ahora muestra 1/1 confirmadas
    const btnActualizar = page.getByRole("button", { name: /actualizar/i });
    await btnActualizar.click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.getByText(/1\/1 confirmadas/i).first()).toBeVisible({ timeout: 10_000 });
    await tomarCaptura(page, `c13-${prefix}-02-confirmada.png`);

    // 5. Ahora el botón Aplicar debe estar HABILITADO
    const btnAplicar = page.getByTitle(/aplicar carga masiva/i).first();
    await expect(btnAplicar).toBeEnabled();
    await btnAplicar.click();

    // Esperar badge APLICADA
    await expect(page.getByText(/aplicada/i).first()).toBeVisible({ timeout: 35_000 });
    await tomarCaptura(page, `c13-${prefix}-03-aplicada.png`);

    // 6. Verificar en BD que el movimiento laboral se registró: 30799436 ahora es PASIVO
    const checkCond = execSync(
      'docker compose exec -T django python manage.py shell -c "' +
        'from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import RepoCondicionTrabajadorORM; ' +
        'from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel; ' +
        'cond = RepoCondicionTrabajadorORM().condicion_por_cedula(\'30799436\').value; ' +
        'egresos = EmployeeEgresadoModel.objects.filter(employee_id=\'30799436\').count(); ' +
        'print(\'COND_POST:\', cond, \'EGRESOS:\', egresos)"',
      { encoding: "utf-8" }
    );
    expect(checkCond).toContain("COND_POST: PASIVO");
    expect(checkCond).toContain("EGRESOS: 1");

    // Espaciamiento para evitar throttle en reversión
    await page.waitForTimeout(3500);

    // 7. Revertir la carga desde Historial
    const btnRevertir = page.getByTitle(/revertir carga completa/i).first();
    await expect(btnRevertir).toBeVisible();
    await btnRevertir.click();

    const btnConfirmarRev = page.getByRole("button", { name: /revertir carga/i }).filter({ hasText: /revertir/i }).last();
    await btnConfirmarRev.click();
    await expect(page.getByText(/revertida/i).first()).toBeVisible({ timeout: 35_000 });
    await tomarCaptura(page, `c13-${prefix}-04-revertida.png`);

    // 8. Verificar que la reversión deshizo el egreso y restauró a ACTIVO
    const checkCondRevert = execSync(
      'docker compose exec -T django python manage.py shell -c "' +
        'from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import RepoCondicionTrabajadorORM; ' +
        'from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel; ' +
        'cond = RepoCondicionTrabajadorORM().condicion_por_cedula(\'30799436\').value; ' +
        'egresos = EmployeeEgresadoModel.objects.filter(employee_id=\'30799436\').count(); ' +
        'print(\'COND_REV:\', cond, \'EGRESOS_REV:\', egresos)"',
      { encoding: "utf-8" }
    );
    expect(checkCondRevert).toContain("COND_REV: ACTIVO");
    expect(checkCondRevert).toContain("EGRESOS_REV: 0");
    await page.waitForTimeout(3000);
  });

  test("C14 - Familiar hijo menor de 9 años con cédula correlativa generada", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    await iniciarSesion(page);
    await page.goto("/personal/carga-masiva");
    await page.waitForLoadState("networkidle").catch(() => {});

    await subirArchivo(page, "c14_hijo_menor_correlativa.xlsx");
    await page.waitForTimeout(4500);

    const tabHistorial = page.getByRole("tab", { name: /historial de cargas/i });
    await tabHistorial.click();
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(page.getByText(/c14_hijo_menor_correlativa\.xlsx/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/analizada/i).first()).toBeVisible({ timeout: 15_000 });

    // Aplicar la carga
    const btnAplicar = page.getByTitle(/aplicar carga masiva/i).first();
    await expect(btnAplicar).toBeVisible();
    await btnAplicar.click();

    await expect(page.getByText(/aplicada/i).first()).toBeVisible({ timeout: 35_000 });
    await tomarCaptura(page, `c14-${prefix}-01-aplicada.png`);

    // Verificar en BD que el hijo fue creado con la cédula correlativa '88007001-1'
    const checkFamiliar = execSync(
      'docker compose exec -T django python manage.py shell -c "' +
        'from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel; ' +
        'fam = EmployeefamilyModel.objects.filter(employeecedula_id=\'88007001\').first(); ' +
        'print(\'FAM_CEDULA:\', fam.cedulaFamiliar if fam else \'NONE\')"',
      { encoding: "utf-8" }
    );
    expect(checkFamiliar).toContain("FAM_CEDULA: 88007001-1");

    // Espaciamiento para reversión
    await page.waitForTimeout(3500);

    // Revertir carga
    const btnRevertir = page.getByTitle(/revertir carga completa/i).first();
    await btnRevertir.click();
    const btnConfirmarRev = page.getByRole("button", { name: /revertir carga/i }).filter({ hasText: /revertir/i }).last();
    await btnConfirmarRev.click();
    await expect(page.getByText(/revertida/i).first()).toBeVisible({ timeout: 35_000 });
    await page.waitForTimeout(3000);
  });

  test("C15 - Control de acceso: Usuario sin permiso de activos o de pasivos", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name === "telefono";
    const prefix = isMobile ? "tel" : "pc";

    // Iniciar sesión con usuario de pasivo (no tiene permiso personal.carga_masiva)
    await page.goto("/login");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.fill('input[type="email"]', "e2e.pasivo@auditoria.local");
    await page.fill('input[type="password"]', "E2eClaude2026*");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });

    // Intentar acceder a la carga masiva de activos
    await page.goto("/personal/carga-masiva");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    await tomarCaptura(page, `c15-${prefix}-01-acceso-denegado.png`);
    expect(await verificarSinDesborde(page, "C15 Acceso Denegado")).toBeTruthy();

    // Debe mostrar denegación de acceso, redirección o falta de permisos
    const esRutaDenegada =
      page.url().includes("/login") ||
      page.url().includes("/dashboard") ||
      (await page.getByText(/no posee el permiso|acceso denegado|no autorizado|403/i).count()) > 0;
    expect(esRutaDenegada).toBeTruthy();
    await page.waitForTimeout(2000);
  });
});
