import { execFileSync } from "node:child_process";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const FOTO_E2E = path.resolve(__dirname, "../fixtures/foto-fe-de-vida-e2e.png");

import {
  api,
  apiJson,
  entrar,
  guardarDescarga,
  ir,
  paso,
  validarPdf,
  vigilar,
} from "./helpers";

const PASIVO_EMAIL = process.env.E2E_PASIVO_EMAIL ?? "";
const PASIVO_PASSWORD = process.env.E2E_PASIVO_PASSWORD ?? "";
const PASIVO_CEDULA = process.env.E2E_PASIVO_CEDULA ?? "99000320";
const BIEN_EMAIL = process.env.E2E_BIEN_EMAIL ?? "";
const BIEN_PASSWORD = process.env.E2E_BIEN_PASSWORD ?? "";

interface Solicitud {
  id: string;
  cedula: string;
  estado: string;
  version: number;
  nombre?: string;
}

interface Bandeja {
  count: number;
  results: Solicitud[];
}

async function solicitudDelPasivo(page: Page): Promise<Solicitud> {
  const bandeja = await apiJson<Bandeja>(page, "fe-de-vida/solicitudes/?limit=100");
  const solicitud = bandeja.results.find((s) => s.cedula === PASIVO_CEDULA);
  if (!solicitud) throw new Error("No se encontró la solicitud del pasivo E2E");
  return solicitud;
}

async function elegirCombo(page: Page, etiqueta: string, texto: string): Promise<boolean> {
  const disparador = page.getByLabel(new RegExp(`^${etiqueta}`, "i")).first();
  await disparador.click();
  const buscador = page.getByPlaceholder(new RegExp(`Buscar ${etiqueta}`, "i")).first();
  const abrio = await buscador
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (!abrio) return false;
  await buscador.fill(texto);
  const opcion = page.getByRole("option", { name: new RegExp(`^${texto}$`, "i") }).first();
  const hayOpcion = await opcion
    .waitFor({ state: "visible", timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (hayOpcion) {
    await opcion.click();
    return true;
  }
  const textoOpcion = page.getByText(texto, { exact: true }).last();
  const hayTexto = await textoOpcion
    .waitFor({ state: "visible", timeout: 2_000 })
    .then(() => true)
    .catch(() => false);
  if (hayTexto) {
    await textoOpcion.click();
    return true;
  }
  await page.keyboard.press("Escape");
  return false;
}

function codigoConstancia(solicitudId: string): string {
  const guion = [
    "from apps.fe_de_vida.infrastructure.models.solicitud_models import ConstanciaFeDeVidaModel",
    `c = ConstanciaFeDeVidaModel.objects.filter(solicitud_id='${solicitudId}').first()`,
    "print(c.codigo_verificacion if c else '')",
  ].join("; ");
  const salida = execFileSync(
    "docker",
    ["exec", "django-App", "python", "manage.py", "shell", "-c", guion],
    { encoding: "utf8" },
  );
  const lineas = salida.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lineas[lineas.length - 1] ?? "";
}

/**
 * Flujo G: ciclo completo de fe de vida.
 * Bienestar devuelve con observación; el pasivo corrige en el teléfono (incluido el
 * país de residencia y la cascada estado/municipio), reenvía; Bienestar aprueba;
 * se descarga la constancia y se verifica en la ficha pública y las estadísticas.
 *
 * El ciclo del pasivo se ejecuta en el proyecto "telefono" (requisito del flujo).
 * En PC se cubre la revisión y la devolución de Bienestar.
 */
test.describe("G · Fe de vida ciclo completo", () => {
  test("devuelve, corrige con país, aprueba, verifica y mide", async ({ page }, info) => {
    test.setTimeout(600_000);
    const vigilante = vigilar(page);
    const incidencias: string[] = [];
    const anotar = (r: { problemas: string[] }) => incidencias.push(...r.problemas);
    const esTelefono = info.project.name === "telefono";

    // ---- Revisión de Bienestar: devolución con observación ----
    await entrar(page, BIEN_EMAIL, BIEN_PASSWORD);
    anotar(await paso(page, info, vigilante, "G", "01-bienestar-sesion"));

    await ir(page, "/pasivos/fe-de-vida");
    await expect(page.getByText(PASIVO_CEDULA).first()).toBeVisible({ timeout: 30_000 });
    anotar(await paso(page, info, vigilante, "G", "02-bandeja-bienestar"));

    let solicitud = await solicitudDelPasivo(page);
    if (solicitud.estado === "PENDIENTE_REVISION") {
      await page
        .locator("tr", { hasText: PASIVO_CEDULA })
        .getByRole("link", { name: /Abrir/i })
        .click();
      await page.waitForURL(/\/pasivos\/fe-de-vida\/[^/]+$/, { timeout: 30_000 });
      await expect(page.getByText(/Revise los datos que el pasivo declara/i)).toBeVisible({
        timeout: 30_000,
      });
      anotar(await paso(page, info, vigilante, "G", "03-detalle-revision"));

      await page.getByRole("button", { name: /Devolver para corrección/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
      await page
        .locator("#dev-motivo")
        .fill("E2E-Observación: confirme el país de residencia y la ubicación (estado/municipio).");
      anotar(await paso(page, info, vigilante, "G", "04-dialogo-devolucion"));
      await page.getByRole("button", { name: /^Devolver$/i }).click();
      await expect(page.locator("body")).toContainText(/devuelta para corrección/i, {
        timeout: 30_000,
      });
      anotar(await paso(page, info, vigilante, "G", "05-devuelta-para-correccion"));
      solicitud = await solicitudDelPasivo(page);
      expect.soft(solicitud.estado, "La solicitud debe quedar DEVUELTA").toBe("DEVUELTA");
    }

    if (!esTelefono) {
      info.annotations.push({
        type: "nota",
        description:
          "El ciclo del pasivo (corrección con País, envío, aprobación, constancia y verificación) se ejecuta en el proyecto teléfono, según el requisito G.",
      });
      expect
        .soft(incidencias, `Incidencias del flujo G (PC):\n${incidencias.join("\n")}`)
        .toEqual([]);
      return;
    }

    // Re-ejecución idempotente: si el ciclo ya quedó VALIDADO, se comprueba el resultado
    // (constancia, verificación pública y estadísticas) sin volver a corregir/enviar.
    if (solicitud.estado === "VALIDADA") {
      info.annotations.push({
        type: "nota",
        description:
          "El ciclo ya estaba VALIDADO de una ejecución anterior; se verifica constancia, ficha pública y estadísticas.",
      });
      const respuesta = await api(page, `fe-de-vida/solicitudes/${solicitud.id}/constancia/`);
      if (respuesta.ok()) {
        const buf = await respuesta.body();
        const pdf = validarPdf(buf);
        expect.soft(pdf.cabecera, "La constancia debe ser un PDF").toBe("%PDF-");
        expect
          .soft(pdf.paginas, "La constancia debe tener al menos una página")
          .toBeGreaterThanOrEqual(1);
      } else {
        incidencias.push(`Constancia no descargable: GET constancia -> ${respuesta.status()}`);
      }
      anotar(await paso(page, info, vigilante, "G", "21-constancia-pdf"));

      const codigo = codigoConstancia(solicitud.id);
      expect.soft(codigo, "La constancia debe tener código de verificación").toHaveLength(64);
      if (codigo) {
        await ir(page, `/fe-de-vida/verificar/${codigo}`);
        await expect(page.getByText(/Constancia válida/i).first()).toBeVisible({ timeout: 30_000 });
        anotar(await paso(page, info, vigilante, "G", "22-verificacion-publica"));
      }

      await ir(page, "/pasivos/fe-de-vida/estadisticas");
      await expect(page.getByText(/Validadas por Bienestar/i).first()).toBeVisible({
        timeout: 30_000,
      });
      anotar(await paso(page, info, vigilante, "G", "24-estadisticas"));

      expect
        .soft(incidencias, `Incidencias del flujo G:\n${incidencias.join("\n")}`)
        .toEqual([]);
      return;
    }

    // ---- Pasivo en el teléfono: corrección completa ----
    await entrar(page, PASIVO_EMAIL, PASIVO_PASSWORD);
    anotar(await paso(page, info, vigilante, "G", "06-pasivo-sesion"));

    await ir(page, "/autogestion/fe-de-vida");
    await expect(page.getByText(/Devuelta para corrección/i).first()).toBeVisible({
      timeout: 30_000,
    });
    anotar(await paso(page, info, vigilante, "G", "07-seguimiento-devuelta"));

    // La guía/aviso de la fe de vida puede abrir un Sheet que intercepta el
    // botón; se cierra explícitamente antes de continuar.
    const entendido = page.getByRole("button", { name: /^Entendido$/i });
    if (await entendido.isVisible().catch(() => false)) {
      await entendido.click();
      await page.waitForTimeout(300);
    }

    await page.getByRole("button", { name: /Corregir y reenviar/i }).click();
    await expect(page.getByRole("heading", { name: /Sus datos/i })).toBeVisible({
      timeout: 30_000,
    });
    anotar(await paso(page, info, vigilante, "G", "08-paso-datos"));

    // La ficha de prueba puede llegar sin teléfonos ni correo alternativo: se completan
    // antes de continuar para no quedar bloqueado en la validación del paso.
    const movil = page.locator("#fv-movil");
    if ((await movil.isVisible().catch(() => false)) && !(await movil.inputValue())) {
      await movil.fill("04121234567");
    }
    const habitacion = page.locator("#fv-habitacion");
    if (
      (await habitacion.isVisible().catch(() => false)) &&
      !(await habitacion.inputValue())
    ) {
      await habitacion.fill("02125551234");
    }
    const correoAlt = page.locator("#fv-correo-alt");
    if (
      (await correoAlt.isVisible().catch(() => false)) &&
      !(await correoAlt.inputValue())
    ) {
      await correoAlt.fill("e2e.pasivo.alt@auditoria.local");
    }
    await page.getByRole("button", { name: /Continuar/i }).click();
    await expect(
      page.getByRole("heading", { name: /Contacto de emergencia/i }).first(),
    ).toBeVisible({ timeout: 30_000 });
    anotar(await paso(page, info, vigilante, "G", "09-paso-emergencia"));

    // Vivienda: país Venezuela -> Chile -> Venezuela, comprobando la cascada.
    const bloqueVivienda = page
      .getByRole("heading", { name: /^Vivienda$/i })
      .locator("xpath=..");
    const botonVivienda = bloqueVivienda.getByRole("button", { name: /Modificar|Registrar|Editar/i });
    await expect(botonVivienda.first()).toBeVisible({ timeout: 15_000 });
    await botonVivienda.first().click();
    const pais = page.getByLabel(/^País/i).first();
    await expect(pais).toBeVisible({ timeout: 15_000 });
    // Espera a que el catálogo termine de cargar (select con opciones o combobox).
    await expect
      .poll(
        async () => {
          const control = page.getByLabel(/^País/i).first();
          const etiqueta = await control.evaluate((el) => el.tagName);
          if (etiqueta === "SELECT") return control.locator("option").count();
          return 99;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(1);
    // Con el catálogo completo (D4) el control pasa a ser un Combobox (>12
    // opciones); con pocos países sigue siendo un <select> nativo.
    const paisEsSelect = await pais.evaluate((el) => el.tagName === "SELECT");
    const elegirPais = async (nombre: string): Promise<boolean> => {
      if (!paisEsSelect) return elegirCombo(page, "País", nombre);
      try {
        await pais.selectOption({ label: nombre }, { timeout: 5_000 });
        return true;
      } catch {
        return false;
      }
    };
    // Se selecciona explícitamente Venezuela (el valor guardado ya debe venir
    // preseleccionado con el arreglo D5; esto además deja el caso listo).
    await elegirPais("Venezuela");
    await expect(page.getByLabel(/^Estado/i).first()).toBeVisible();
    anotar(await paso(page, info, vigilante, "G", "10-vivienda-venezuela"));

    // País extranjero + cascada: al elegir Chile deben desaparecer Estado y
    // Municipio y aparecer «Ciudad o región».
    const cambioChile = await elegirPais("Chile");
    if (cambioChile) {
      await expect(page.getByLabel(/^Ciudad o región/i).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByLabel(/^Estado/i)).toHaveCount(0);
      await expect(page.getByLabel(/^Municipio/i)).toHaveCount(0);
      anotar(
        await paso(page, info, vigilante, "G", "11-pais-chile-sin-estado-municipio"),
      );
      const volvioVenezuela = await elegirPais("Venezuela");
      if (!volvioVenezuela) {
        incidencias.push("No se pudo volver a Venezuela tras probar Chile.");
      }
    } else {
      incidencias.push(
        "Catálogo de países sin Chile: no se pudo verificar el país extranjero ni la cascada ciudad/región.",
      );
      anotar(await paso(page, info, vigilante, "G", "11-pais-chile-no-disponible"));
    }

    await expect(page.getByLabel(/^Estado/i).first()).toBeVisible({ timeout: 15_000 });
    const estadoOk = await elegirCombo(page, "Estado", "COJEDES");
    const municipioOk = await elegirCombo(page, "Municipio", "SAN CARLOS");
    const parroquiaOk = await elegirCombo(page, "Parroquia", "SAN CARLOS");
    const postalOk = await elegirCombo(page, "Código postal", "2214");
    if (!estadoOk || !municipioOk || !parroquiaOk || !postalOk) {
      incidencias.push(
        `No se pudieron seleccionar todos los datos de ubicación de Venezuela (estado=${estadoOk}, municipio=${municipioOk}, parroquia=${parroquiaOk}, postal=${postalOk}).`,
      );
    }
    // El registro actual trae "calle" (5 caracteres) y el formulario exige 10:
    // se completa una dirección válida y se reselecciona la condición de vivienda.
    const direccion = page.getByLabel(/^Dirección exacta/i).first();
    if (await direccion.isVisible().catch(() => false)) {
      await direccion.fill("calle E2E verificada 123");
    }
    const condicion = page.getByLabel(/^Condición de la vivienda/i).first();
    const condicionOk = await condicion
      .selectOption({ label: "ALQUILADA" }, { timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (!condicionOk) {
      incidencias.push("No se pudo seleccionar la condición de vivienda ALQUILADA.");
    }
    anotar(await paso(page, info, vigilante, "G", "12-pais-venezuela-estado-municipio"));

    await page.getByRole("button", { name: /Guardar cambio/i }).click();
    await expect(page.getByRole("button", { name: /Guardar cambio/i })).toBeHidden({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /^Continuar$/i }).click();

    // La ficha E2E puede tener hijos: en ese caso el asistente inserta el paso
    // «Sus hijos» entre la vivienda y la foto. Se avanza hasta la foto en vez de
    // asumir que vivienda salta directo a la captura.
    for (let intento = 0; intento < 3; intento++) {
      const foto = page.getByRole("heading", { name: /Foto con su cédula/i });
      if (await foto.isVisible().catch(() => false)) break;
      const hijos = page.getByRole("heading", { name: /^Sus hijos$/i });
      if (await hijos.isVisible().catch(() => false)) {
        await page.getByRole("button", { name: /^Continuar$/i }).click();
        await page.waitForTimeout(500);
        continue;
      }
      await page.waitForTimeout(1_000);
    }
    anotar(await paso(page, info, vigilante, "G", "13-vivienda-guardada"));

    await expect(page.getByRole("heading", { name: /Foto con su cédula/i })).toBeVisible({
      timeout: 30_000,
    });
    anotar(await paso(page, info, vigilante, "G", "14-paso-foto"));
    // Si la solicitud no tiene foto vigente (o la devolución exigió una nueva) el
    // botón Continuar está deshabilitado hasta elegir un archivo.
    const continuarFoto = page.getByRole("button", { name: /^Continuar$/i });
    if (!(await continuarFoto.isEnabled().catch(() => false))) {
      await page.locator('input[type="file"]').first().setInputFiles(FOTO_E2E);
      await expect(continuarFoto).toBeEnabled({ timeout: 30_000 });
    }
    await continuarFoto.click();

    await expect(page.getByRole("heading", { name: /Revise y envíe/i })).toBeVisible({
      timeout: 30_000,
    });
    anotar(await paso(page, info, vigilante, "G", "15-paso-revisar"));
    await page.locator('input[type="checkbox"]').last().check();
    await page.getByRole("button", { name: /Enviar fe de vida/i }).click();
    await expect(page.locator("body")).toContainText(/en revisión|fe de vida enviada|seguimiento/i, {
      timeout: 30_000,
    });
    anotar(await paso(page, info, vigilante, "G", "16-enviada"));

    // ---- Bienestar aprueba y emite constancia ----
    await entrar(page, BIEN_EMAIL, BIEN_PASSWORD);
    anotar(await paso(page, info, vigilante, "G", "17-bienestar-sesion-2"));
    await ir(page, "/pasivos/fe-de-vida");
    await expect(page.getByText(PASIVO_CEDULA).first()).toBeVisible({ timeout: 30_000 });
    await page
      .locator("tr", { hasText: PASIVO_CEDULA })
      .getByRole("link", { name: /Abrir/i })
      .click();
    await page.waitForURL(/\/pasivos\/fe-de-vida\/[^/]+$/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Aprobación directa/i })).toBeVisible({
      timeout: 30_000,
    });
    anotar(await paso(page, info, vigilante, "G", "18-revision-para-aprobar"));

    await page.getByRole("button", { name: /Aprobación directa/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await page
      .locator("#dec-texto")
      .fill("E2E-Aprobación: país y ubicación verificados con el pasivo.");
    anotar(await paso(page, info, vigilante, "G", "19-dialogo-aprobacion"));
    await page.getByRole("button", { name: /^Aprobar$/i }).click();
    // La palabra «validada» aparece en la propia pantalla antes de aprobar
    // (filtros/etiquetas), así que se espera la señal real: la constancia solo
    // se habilita cuando la solicitud quedó VALIDADA.
    await expect(page.getByRole("button", { name: /Imprimir constancia/i })).toBeVisible({
      timeout: 60_000,
    });
    anotar(await paso(page, info, vigilante, "G", "20-validada"));

    solicitud = await solicitudDelPasivo(page);
    if (solicitud.estado !== "VALIDADA") {
      incidencias.push(`La solicitud quedó en estado ${solicitud.estado}, se esperaba VALIDADA`);
    }

    await expect(page.getByRole("button", { name: /Imprimir constancia/i })).toBeVisible({
      timeout: 30_000,
    });
    const esperaDescarga = page.waitForEvent("download", { timeout: 15_000 }).catch(() => null);
    await page.getByRole("button", { name: /Imprimir constancia/i }).click();
    const descarga = await esperaDescarga;
    let pdfBuffer: Buffer | null = null;
    if (descarga) {
      pdfBuffer = await guardarDescarga(descarga, `${info.project.name}-G-constancia.pdf`);
    } else {
      const respuesta = await api(
        page,
        `fe-de-vida/solicitudes/${solicitud.id}/constancia/`,
      );
      if (respuesta.ok()) {
        pdfBuffer = await respuesta.body();
      } else {
        incidencias.push(`Constancia no descargable: GET constancia -> ${respuesta.status()}`);
      }
    }
    if (pdfBuffer) {
      const pdf = validarPdf(pdfBuffer);
      expect.soft(pdf.cabecera, "La constancia debe ser un PDF").toBe("%PDF-");
      expect.soft(pdf.paginas, "La constancia debe tener al menos una página").toBeGreaterThanOrEqual(
        1,
      );
    } else {
      incidencias.push("No se obtuvo el PDF de la constancia");
    }
    anotar(await paso(page, info, vigilante, "G", "21-constancia-pdf"));

    const codigo = codigoConstancia(solicitud.id);
    expect.soft(codigo, "La constancia debe tener código de verificación").toHaveLength(64);
    if (codigo) {
      await ir(page, `/fe-de-vida/verificar/${codigo}`);
      await expect(page.getByText(/Constancia válida/i).first()).toBeVisible({ timeout: 30_000 });
      anotar(await paso(page, info, vigilante, "G", "22-verificacion-publica"));
    }

    await ir(page, "/pasivos/fe-de-vida/estadisticas");
    await expect(page.getByText(/Validadas por Bienestar/i).first()).toBeVisible({
      timeout: 30_000,
    });
    anotar(await paso(page, info, vigilante, "G", "24-estadisticas"));

    expect
      .soft(incidencias, `Incidencias del flujo G:\n${incidencias.join("\n")}`)
      .toEqual([]);
  });
});
