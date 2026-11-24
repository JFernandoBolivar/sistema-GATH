import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { iniciarSesionE2E } from "./credenciales";
import {
  activarPlantilla,
  CLAVE_NUEVA,
  crearPlantillaDePrueba,
  esperarHidratacion,
  postulanteCompletaTodoPorApi,
  prepararAprobado,
  reabrirVentana2,
  sinDesbordeHorizontal,
  type Preparado,
} from "./ventana2-api";

/**
 * Documentos dentro del expediente (F-4, F-5, F-6): el postulante llena el campo propio de una plantilla, ve su planilla prellenada,
 * firma por clic y envía; Captación ve el documento firmado con la evidencia y lo descarga.
 *
 * Preparación por API (como `ventana2-contratacion.spec.ts`): expediente APROBADO con puesto reservado, Ventana 2 reabierta, todo
 * lo del formulario y la foto completos salvo el paso «Documentos», y una plantilla de prueba PUBLICADA y ACTIVA con un campo propio
 * obligatorio y firma por clic.
 *
 * IMPORTANTE (limpieza): la plantilla activa obligaría a firmar a cualquier otro expediente en Ventana 2, así que el `finally`
 * la DESACTIVA. Quedan en la base de desarrollo: la plantilla E2E_DOC_<n> (inactiva, con su versión 1 inmutable: no hay borrado),
 * el expediente de prueba con su puesto RESERVADO (reserva ACTIVA: liberarla), los valores de los campos propios, el documento
 * generado y su firma. El test NO llega a contratar: no se crea ningún Employee. Se anota `limpiar-auditor` con los ids.
 */
const FOTO = join(__dirname, "fixtures", "foto-ventana2-400.png");

const VISTAS = [
  { nombre: "escritorio", viewport: { width: 1280, height: 800 } },
  { nombre: "móvil 390x844", viewport: { width: 390, height: 844 } },
] as const;

async function entrarComoPostulante(browser: Browser, viewport: { width: number; height: number }, cedula: string) {
  const contexto = await browser.newContext({ viewport });
  const page = await contexto.newPage();
  page.setDefaultTimeout(30_000);
  await page.goto("/postulacion/acceso");
  await esperarHidratacion(page);
  await page.getByLabel("Cédula de identidad").fill(cedula);
  await page.getByLabel("Contraseña", { exact: true }).fill(CLAVE_NUEVA);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((u) => u.pathname === "/postulacion");
  await esperarHidratacion(page);
  return { contexto, page };
}

/** El PDF que sirve el Route Handler del postulante (misma sesión/cookies que la página). */
async function pdfDeLaPlanilla(page: Page, codigo: string, tipo: "vista-previa" | "archivo") {
  const r = await page.request.get(`/postulacion/documento/${codigo}?tipo=${tipo}`);
  return { estado: r.status(), tipo: r.headers()["content-type"] ?? "", cuerpo: await r.body() };
}

for (const { nombre, viewport } of VISTAS) {
  test(`documentos: llenar, ver la planilla, firmar, enviar y revisión de Captación (${nombre})`, async ({ browser }) => {
    test.setTimeout(420_000);
    const movil = viewport.width < 768;
    const contexto = await browser.newContext({ viewport });
    const page = await contexto.newPage();
    page.setDefaultTimeout(30_000);
    const codigo = `E2E_DOC_${Date.now().toString(36).toUpperCase()}`;
    let preparado: Preparado | null = null;
    let plantillaId: string | null = null;
    let admin: Record<string, string> = {};
    let contextoPostulante: BrowserContext | null = null;
    let request: APIRequestContext = page.request;

    try {
      await iniciarSesionE2E(page);
      request = page.request;
      preparado = await prepararAprobado(contexto, request);
      admin = preparado.admin;
      const { cedula, expedienteId } = preparado;
      plantillaId = await crearPlantillaDePrueba(request, admin, codigo);
      const clave = await reabrirVentana2(request, admin, expedienteId);
      await postulanteCompletaTodoPorApi(request, cedula, clave, readFileSync(FOTO));

      // El postulante entra: todo lo demás está completo, así que abre directo en «Documentos».
      const sesion = await entrarComoPostulante(browser, viewport, cedula);
      contextoPostulante = sesion.contexto;
      const post = sesion.page;
      await expect(post.getByRole("heading", { name: "Documentos", exact: true })).toBeVisible();
      const tarjeta = post.getByTestId(`documento-${codigo}`);
      await expect(tarjeta).toBeVisible();
      await expect(tarjeta.getByTestId("estado-documento")).toHaveText(/faltan datos/i);
      if (movil) await sinDesbordeHorizontal(post);

      // Sin llenar el obligatorio no se puede firmar; la casilla de conformidad lleva el texto de la plantilla.
      await expect(tarjeta.getByText(/acepto y declaro/i)).toBeVisible();
      await tarjeta.getByRole("checkbox").check();
      await tarjeta.getByRole("button", { name: "Firmar documento" }).click();
      await expect(tarjeta.getByRole("alert").filter({ hasText: /completa antes de firmar/i })).toContainText("Sueldo al que aspira");

      // Revisar y enviar lo marca como pendiente y no deja enviar.
      await post.getByRole("button", { name: /continuar/i }).click();
      await expect(post.getByTestId("lista-faltantes")).toContainText(/complete los datos del documento/i);
      await expect(post.getByRole("button", { name: /enviar mis datos/i })).toBeDisabled();
      await post.getByTestId("lista-faltantes").getByRole("button").filter({ hasText: /documento/i }).first().click();
      await expect(tarjeta).toBeVisible();

      // Llena el campo propio y ve SU planilla prellenada (PDF con sus datos).
      await tarjeta.getByLabel(/sueldo al que aspira/i).fill("1500 USD");
      await tarjeta.getByLabel(/fecha de inicio/i).fill("2026-12-01");
      await tarjeta.getByRole("button", { name: "Guardar datos" }).click();
      await expect(tarjeta.getByText("Datos guardados.")).toBeVisible();
      await expect(tarjeta.getByTestId("estado-documento")).toHaveText(/falta tu firma/i);
      const popup = post.context().waitForEvent("page");
      await tarjeta.getByRole("button", { name: /ver mi planilla/i }).click();
      await popup.then((p) => p.close()).catch(() => {});
      const previa = await pdfDeLaPlanilla(post, codigo, "vista-previa");
      expect(previa.estado).toBe(200);
      expect(previa.tipo).toContain("application/pdf");
      expect(previa.cuerpo.subarray(0, 5).toString()).toBe("%PDF-");

      // Firma por clic de conformidad: queda la evidencia y el PDF firmado se puede ver.
      await tarjeta.getByRole("checkbox").check();
      await tarjeta.getByRole("button", { name: "Firmar documento" }).click();
      await expect(tarjeta.getByText("Documento firmado", { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(tarjeta.getByTestId("estado-documento")).toHaveText(/firmado/i);
      await expect(tarjeta.getByRole("link", { name: /ver mi documento firmado/i })).toBeVisible();
      const firmado = await pdfDeLaPlanilla(post, codigo, "archivo");
      expect(firmado.estado).toBe(200);
      expect(firmado.cuerpo.subarray(0, 5).toString()).toBe("%PDF-");

      // Cambiar un dato tras firmar deshace la firma: hay que firmar de nuevo.
      await tarjeta.getByLabel(/sueldo al que aspira/i).fill("1800 USD");
      await tarjeta.getByRole("button", { name: "Guardar datos" }).click();
      await expect(tarjeta.getByText(/firma anterior quedó sin efecto/i).first()).toBeVisible();
      await expect(tarjeta.getByTestId("estado-documento")).toHaveText(/falta tu firma/i);
      expect((await pdfDeLaPlanilla(post, codigo, "archivo")).estado).toBe(404);
      await tarjeta.getByRole("checkbox").check();
      await tarjeta.getByRole("button", { name: "Firmar documento" }).click();
      await expect(tarjeta.getByText("Documento firmado", { exact: true })).toBeVisible({ timeout: 30_000 });
      if (movil) await sinDesbordeHorizontal(post);

      // Ahora sí se puede enviar.
      await post.getByRole("button", { name: /continuar/i }).click();
      await expect(post.getByRole("button", { name: /enviar mis datos/i })).toBeEnabled();
      await post.getByRole("button", { name: /enviar mis datos/i }).click();
      await post.getByRole("alertdialog").getByRole("button", { name: /sí, enviar/i }).click();
      await post.waitForURL(/\/postulacion\/recibido\?.*v=2/);
      await contextoPostulante.close();
      contextoPostulante = null;

      // Captación: pestaña «Documentos» con el estado, lo llenado, la evidencia (IP enmascarada) y el PDF.
      await page.goto(`/captacion/expedientes/${expedienteId}`);
      await esperarHidratacion(page);
      await expect(page.getByText("Revisión final").first()).toBeVisible();
      await page.getByRole("tab", { name: /^documentos$/i }).click();
      const fila = page.getByTestId(`documento-${codigo}`);
      await expect(fila).toBeVisible();
      await expect(fila.getByTestId("estado-documento")).toHaveText(/firmado/i);
      await expect(fila).toContainText("1800 USD");
      const evidencia = fila.getByTestId("evidencia-firma");
      await expect(evidencia).toBeVisible();
      await expect(evidencia).toContainText("•");
      await expect(evidencia).toContainText(/acepto y declaro/i);
      if (movil) await sinDesbordeHorizontal(page);
      const descarga = page.waitForEvent("download");
      await fila.getByRole("button", { name: /descargar el pdf/i }).click();
      const archivo = await descarga;
      expect(archivo.suggestedFilename()).toMatch(/\.pdf$/);
    } finally {
      // La plantilla activa obligaría a firmar a los demás expedientes en Ventana 2: se desactiva siempre.
      if (plantillaId) await activarPlantilla(request, admin, plantillaId, false).catch(() => {});
      if (preparado) {
        test.info().annotations.push({
          type: "limpiar-auditor",
          description:
            `Plantilla ${codigo} (${plantillaId ?? "no creada"}) INACTIVA pero publicada (no se puede borrar); expediente ${preparado.numero} ` +
            `(${preparado.expedienteId}), cédula ${preparado.cedula}, puesto ${preparado.puestoId} con reserva ACTIVA (liberarla); ` +
            "filas de valores, documento generado y firma del expediente. No se contrató: no hay Employee.",
        });
      }
      await contextoPostulante?.close().catch(() => {});
      await contexto.close();
    }
  });
}
