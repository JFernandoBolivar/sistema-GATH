import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import {
  ahoraLocal,
  api,
  apiJson,
  entrar,
  ir,
  paso,
  vigilar,
} from "./helpers";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";

interface EventoCreado {
  id: string;
  nombre: string;
  categorias: Array<{ id: string; nombre: string }>;
  zonas: Array<{ id: string; nombre: string }>;
}

interface Invitado {
  id: string;
  nombre_completo: string;
  estado: string;
  codigo_credencial: string;
  security_hash: string;
  zona_nombre: string;
}

interface Panel {
  total_invitados: number;
  credenciales_emitidas: number;
  entraron: number;
  faltan: number;
  porcentaje_asistencia: number;
}

async function buscarEvento(
  page: Parameters<typeof paso>[0],
  nombre: string,
): Promise<EventoCreado> {
  const eventos = await apiJson<EventoCreado[]>(
    page,
    `carnetizacion/eventos/?busqueda=${encodeURIComponent(nombre)}`,
  );
  const evento = eventos.find((e) => e.nombre === nombre);
  if (!evento) throw new Error("El evento creado no aparece en la API");
  return evento;
}

async function invitadosDe(
  page: Parameters<typeof paso>[0],
  eventoId: string,
): Promise<Invitado[]> {
  return apiJson<Invitado[]>(page, `carnetizacion/eventos/${eventoId}/invitados/`);
}

async function esperarCodigo(
  page: Parameters<typeof paso>[0],
  eventoId: string,
  nombre: string,
): Promise<Invitado> {
  for (let intento = 0; intento < 15; intento++) {
    const invitado = (await invitadosDe(page, eventoId)).find(
      (i) => i.nombre_completo === nombre,
    );
    if (invitado?.codigo_credencial) return invitado;
    await page.waitForTimeout(1000);
  }
  const invitado = (await invitadosDe(page, eventoId)).find(
    (i) => i.nombre_completo === nombre,
  );
  if (!invitado) throw new Error(`No se encontró al invitado ${nombre}`);
  return invitado;
}

/**
 * Borra los eventos E2E anteriores. El código INV-NNNN se genera por evento pero la
 * columna es única global: sin esta limpieza, el segundo evento choca con INV-0001.
 */
function limpiarEventosE2E(): void {
  const guion = [
    "from apps.carnetizacion.infrastructure.models.carnetizacion_models import EventoModel, EventoInvitadoModel, EventoRegistroAccesoModel",
    "ids = list(EventoModel.objects.filter(nombre__startswith='E2E-').values_list('id', flat=True))",
    "EventoInvitadoModel.objects.filter(evento_id__in=ids).delete()",
    "EventoRegistroAccesoModel.objects.filter(evento_id__in=ids).delete()",
    "EventoModel.objects.filter(id__in=ids).delete()",
    "print(len(ids))",
  ].join("; ");
  execFileSync("docker", ["exec", "django-App", "python", "manage.py", "shell", "-c", guion], {
    encoding: "utf8",
  });
}

async function escanear(page: Parameters<typeof paso>[0], codigo: string) {
  const entrada = page.getByPlaceholder(/Escanea el QR o ingresa código/i);
  await entrada.fill(codigo);
  await page.getByRole("button", { name: /^Validar$/i }).click();
}

/**
 * Flujo E: eventos y control de entrada con QR.
 * Evento con categorías/zonas por defecto, invitado manual, importación CSV,
 * emisión de gafetes, check-in permitido, repetido, invitado anulado y panel.
 */
test.describe("E · Eventos y control QR", () => {
  test("crea evento, acredita invitados y controla entradas", async ({ page }, info) => {
    test.setTimeout(360_000);
    const vigilante = vigilar(page);
    const incidencias: string[] = [];
    const anotar = (r: { problemas: string[] }) => incidencias.push(...r.problemas);
    const sufijo = Date.now().toString().slice(-6);
    const nombreEvento = `E2E-Evento ${sufijo}`;
    const nombreManual = `E2E-Invitado Manual ${sufijo}`;
    const nombreCsvUno = `E2E-Invitado CSV Uno ${sufijo}`;
    const nombreCsvDos = `E2E-Invitado CSV Dos ${sufijo}`;

    await entrar(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    anotar(await paso(page, info, vigilante, "E", "01-sesion-iniciada"));

    limpiarEventosE2E();
    await ir(page, "/carnetizacion/eventos");
    await expect(page.getByRole("button", { name: /Nuevo Evento/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /Nuevo Evento/i }).click();
    await expect(page.getByText(/Configuración inicial por defecto/i)).toBeVisible({
      timeout: 10_000,
    });
    anotar(await paso(page, info, vigilante, "E", "02-dialogo-nuevo-evento"));

    await page.getByLabel(/Nombre del evento/i).fill(nombreEvento);
    await page.getByLabel(/Lugar/i).fill("Auditorio E2E");
    const ahora = new Date();
    const fin = new Date(ahora.getTime() + 4 * 60 * 60 * 1000);
    await page.getByLabel(/Fecha y hora inicio/i).fill(ahoraLocal(ahora));
    await page.getByLabel(/Fecha y hora fin/i).fill(ahoraLocal(fin));
    await page.getByRole("button", { name: /^Crear Evento$/i }).click();
    await expect(page.getByText(nombreEvento).first()).toBeVisible({ timeout: 25_000 });
    anotar(await paso(page, info, vigilante, "E", "03-evento-creado"));

    const evento = await buscarEvento(page, nombreEvento);
    expect.soft(evento.categorias.length, "El evento debe tener categorías").toBeGreaterThan(0);
    expect.soft(evento.zonas.length, "El evento debe tener zonas").toBeGreaterThan(0);

    await ir(page, `/carnetizacion/eventos/${evento.id}`);
    await expect(page.getByRole("button", { name: /Agregar Invitado/i })).toBeVisible({
      timeout: 25_000,
    });
    anotar(await paso(page, info, vigilante, "E", "04-panel-evento"));

    await page.getByRole("button", { name: /Agregar Invitado/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await page.getByLabel(/Nombre y Apellido/i).fill(nombreManual);
    await page.getByLabel(/Cédula \/ Documento/i).fill(`E2E-E-${sufijo}`);
    await page.getByLabel(/Organización \/ Empresa/i).fill("E2E-Organización");
    anotar(await paso(page, info, vigilante, "E", "05-dialogo-invitado-manual"));
    await page.getByRole("button", { name: /Guardar Invitado/i }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText(nombreManual)).toBeVisible({ timeout: 20_000 });
    anotar(await paso(page, info, vigilante, "E", "06-invitado-manual-registrado"));

    const csv = [
      "nombre,categoria,zona,documento,organizacion,correo,telefono,mesa",
      `${nombreCsvUno},Invitado especial,Salón principal,E2E-CSV-1,E2E-Org,,,`,
      `${nombreCsvDos},Autoridad,Área de prensa,E2E-CSV-2,E2E-Org,,,`,
    ].join("\n");
    await page.getByRole("button", { name: /Importar Lista/i }).click();
    await expect(page.getByText(/Importar Asistentes e Invitados/i)).toBeVisible({
      timeout: 10_000,
    });
    await page.locator("#csv-upload").setInputFiles({
      name: "E2E-invitados.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });
    await expect(page.getByText(/Confirmar e Importar \(2\)/i)).toBeVisible({ timeout: 20_000 });
    anotar(await paso(page, info, vigilante, "E", "07-previsualizacion-csv"));
    await page.getByRole("button", { name: /Confirmar e Importar/i }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 25_000 });
    await expect(page.getByText(nombreCsvUno)).toBeVisible({ timeout: 20_000 });
    anotar(await paso(page, info, vigilante, "E", "08-csv-importado"));

    await page.getByRole("button", { name: /Emitir en Lote/i }).click();
    const manual = await esperarCodigo(page, evento.id, nombreManual);
    const csvUno = await esperarCodigo(page, evento.id, nombreCsvUno);
    const csvDos = await esperarCodigo(page, evento.id, nombreCsvDos);
    expect.soft(manual.codigo_credencial, "El invitado manual debe tener código").toBeTruthy();
    anotar(await paso(page, info, vigilante, "E", "09-gafetes-emitidos"));

    await ir(page, `/carnetizacion/control-eventos?evento_id=${evento.id}`);
    await expect(page.getByPlaceholder(/Escanea el QR o ingresa código/i)).toBeVisible({
      timeout: 25_000,
    });
    anotar(await paso(page, info, vigilante, "E", "10-control-entrada"));

    await escanear(page, manual.codigo_credencial);
    await expect(page.locator("body")).toContainText(/acceso permitido/i, { timeout: 25_000 });
    anotar(await paso(page, info, vigilante, "E", "11-acceso-permitido"));

    await escanear(page, manual.codigo_credencial);
    await expect(page.locator("body")).toContainText(/ya ingresó/i, { timeout: 25_000 });
    anotar(await paso(page, info, vigilante, "E", "12-ya-ingreso"));

    const anulacion = await api(page, `carnetizacion/eventos/invitados/${csvDos.id}/`, {
      method: "PATCH",
      data: { estado: "anulado" },
    });
    expect.soft(anulacion.ok(), "El invitado debe poder anularse").toBeTruthy();
    await escanear(page, csvDos.codigo_credencial);
    await expect(page.locator("body")).toContainText(/no válida/i, { timeout: 25_000 });
    anotar(await paso(page, info, vigilante, "E", "13-invitado-anulado"));

    const panel = await apiJson<Panel>(page, `carnetizacion/eventos/${evento.id}/panel/`);
    expect.soft(panel.total_invitados, "El panel debe contar 3 invitados").toBe(3);
    // La credencial anulada deja de contar como emitida: quedan 1 ingreso + 1 emitida.
    expect
      .soft(panel.credenciales_emitidas, "Deben figurar 2 credenciales vigentes (1 anulada)")
      .toBe(2);
    expect.soft(panel.entraron, "Debe figurar 1 ingreso").toBe(1);
    expect.soft(panel.faltan, "Deben faltar 2 invitados").toBe(2);
    if (panel.total_invitados !== 3) {
      incidencias.push(`Panel con total_invitados=${panel.total_invitados} (esperado 3)`);
    }
    if (panel.entraron !== 1) {
      incidencias.push(`Panel con entraron=${panel.entraron} (esperado 1)`);
    }
    anotar(await paso(page, info, vigilante, "E", "14-panel-cifras"));

    // Deja constancia de los códigos usados en el informe.
    incidencias.push(
      `Códigos usados: manual=${manual.codigo_credencial}, csv1=${csvUno.codigo_credencial}, csv2=${csvDos.codigo_credencial}`,
    );

    expect
      .soft(incidencias.filter((i) => !i.startsWith("Códigos usados")), `Incidencias del flujo E:\n${incidencias.join("\n")}`)
      .toEqual([]);
  });
});
