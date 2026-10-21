import { test, expect } from "@playwright/test";

const EMAIL = "hmachado@conatel.gob.ve";
const PASSWORD = "Conatel123*";
const ARTIFACT_DIR = "/home/jbolivar@conatel.gob.ve/.gemini/antigravity-cli/brain/4f3a6a47-9b0b-47b3-9be1-2c8212a19b56/scratch";

test.describe("Portal de Autogestión CONATEL Rediseñado", () => {
  test("Carga expediente de trabajador, cursos institucionales, carnet digital y marco legal", async ({ page }) => {
    // 1. Iniciar sesión con el trabajador titular
    await page.goto("/login");
    await page.getByLabel(/correo electrónico/i).fill(EMAIL);
    await page.getByLabel(/contraseña/i).fill(PASSWORD);
    await page.getByRole("button", { name: /iniciar sesión/i }).click();

    // Esperar redirección al dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // 2. Navegar a /autogestion
    await page.goto("/autogestion");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Verificar cabecera institucional
    await expect(page.getByText("HITLER MOISES MACHADO CORRO").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("C.I. 30540767")).toBeVisible();
    await expect(page.getByText("CONATEL • GATH")).toBeVisible();
    await expect(page.getByRole("img", { name: /fotografía del trabajador/i })).toBeVisible();

    // Verificar fecha y ausencia de nan
    const cardIdentificacion = page.locator("text=Identificación & Datos de Contacto").locator("xpath=ancestor::div[contains(@class, 'rounded-xl')]");
    await cardIdentificacion.scrollIntoViewIfNeeded();
    await expect(page.getByText("Teléfono Habitación")).toBeVisible();
    await expect(page.getByText("20/06/2004")).toBeVisible();

    // Capturar vista general
    await page.screenshot({ path: `${ARTIFACT_DIR}/autogestion_1_personal.png`, fullPage: false });

    // 2.1 Pestaña: Ubicación Laboral
    const tabLaboral = page.getByRole("tab", { name: /ubicación laboral/i });
    await expect(tabLaboral).toBeVisible();
    await tabLaboral.click();
    await expect(page.getByText("Modalidad de Ingreso al Cargo")).toBeVisible();
    await page.screenshot({ path: `${ARTIFACT_DIR}/autogestion_laboral.png`, fullPage: true });

    // 3. Pestaña: Formación & Cursos
    const tabCursos = page.getByRole("tab", { name: /formación & cursos/i });
    await expect(tabCursos).toBeVisible();
    await tabCursos.click();

    // Verificar que aparecen los cursos y capacitaciones
    await expect(page.getByText(/Regulación del Espectro Radioeléctrico/i)).toBeVisible();
    await expect(page.getByText(/Ciberseguridad y Protección de Redes/i)).toBeVisible();
    await expect(page.getByText(/Centro de Estudios de Telecomunicaciones CONATEL/i).first()).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/autogestion_2_cursos.png`, fullPage: true });

    // 4. Pestaña: Mi Carnet Institucional
    const tabCarnet = page.getByRole("tab", { name: /carnet institucional/i });
    await expect(tabCarnet).toBeVisible();
    await tabCarnet.click();

    // Verificar vista previa de carnet y datos de seguridad
    await expect(page.getByText("Credencial Digital Oficial")).toBeVisible();
    await expect(page.getByText("Activo y Vigente")).toBeVisible();
    await expect(page.getByText(/Hash Criptográfico de Verificación/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /descargar carnet pdf/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /solicitar renovación/i })).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/autogestion_3_carnet.png`, fullPage: true });

    // 5. Pestaña: Marco Legal
    const tabLegal = page.getByRole("tab", { name: /marco legal/i });
    await expect(tabLegal).toBeVisible();
    await tabLegal.click();

    // Verificar fundamentos jurídicos
    await expect(page.getByText(/Constitución de la República Bolivariana de Venezuela/i).first()).toBeVisible();
    await expect(page.getByText(/Ley Orgánica de Telecomunicaciones/i).first()).toBeVisible();
    await expect(page.getByText(/Ley del Estatuto de la Función Pública/i).first()).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/autogestion_4_marco_legal.png`, fullPage: true });

    // 6. Probar apertura del Modal de Renovación / Solicitud de Carnet
    await tabCarnet.click();
    await page.getByRole("button", { name: /solicitar renovación/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Renovación de Carnet Institucional")).toBeVisible();
    await expect(page.getByLabel(/motivo de la emisión/i)).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/autogestion_5_modal_solicitud.png` });

    // Cerrar modal
    await page.getByRole("button", { name: /cancelar/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});
