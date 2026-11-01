import { expect, test, type Page } from "@playwright/test";

import { EMAIL, PASSWORD } from "./credenciales";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * G9: el reporte filtra por años APN oficiales y la columna coincide con la
 * ficha del empleado (que usa `calcular_total_apn`, 30/360, solo cerrados).
 *
 * La muestra se toma de la BD real: empleados con `total_anos_apn > 0` según
 * la anotación oficial. Se comparan hasta 5 con `/personal/{cedula}/`.
 */
const DJANGO = process.env.E2E_DJANGO_URL ?? "http://127.0.0.1:8001";

async function tokenDeAcceso(page: Page) {
  const cookies = await page.context().cookies();
  const token = cookies.find((c) => c.name === "dj_access")?.value;
  expect(token).toBeTruthy();
  return token as string;
}

async function getJson(page: Page, ruta: string, token: string) {
  const respuesta = await page.request.get(`${DJANGO}${ruta}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(respuesta.ok(), `${ruta} -> ${respuesta.status()}`).toBeTruthy();
  return respuesta.json();
}

test("G9: el filtro y la columna APN usan el cálculo oficial", async ({ page }) => {
  await iniciarSesionComo(page, EMAIL, PASSWORD);
  const token = await tokenDeAcceso(page);

  const reporte = await getJson(
    page,
    "/api/v1/reportes/personal-activo/?apn_min=0.0001&apn_max=200",
    token,
  );
  const filas = (reporte.data.filas as Array<Record<string, unknown>>).filter(
    (f) => Number(f.total_anos_apn) > 0,
  );
  expect(filas.length).toBeGreaterThan(0);

  // Cuatro cuentas con antecedentes cerrados + una con APN oficial 0 (por
  // ejemplo, solo antecedente abierto o sin antecedentes) = 5 fichas.
  const cero = await getJson(
    page,
    "/api/v1/reportes/personal-activo/?apn_min=0&apn_max=0",
    token,
  );
  const conCero = (cero.data.filas as Array<Record<string, unknown>>)[0];
  const muestra = [...filas.slice(0, 4), conCero].filter(Boolean);
  for (const fila of muestra) {
    const detalle = await getJson(
      page,
      `/api/v1/personal/${fila.cedula}/`,
      token,
    );
    expect(Number(detalle.data.total_anos_apn)).toBeCloseTo(
      Number(fila.total_anos_apn),
      4,
    );
  }

  // El filtro apn_min aplica sobre la misma anotación: ninguna fila queda por
  // debajo del mínimo solicitado.
  const minimo = Math.min(...filas.slice(0, 4).map((f) => Number(f.total_anos_apn)));
  const filtrado = await getJson(
    page,
    `/api/v1/reportes/personal-activo/?apn_min=${minimo}`,
    token,
  );
  for (const fila of filtrado.data.filas as Array<Record<string, unknown>>) {
    if (Number(fila.total_anos_apn) > 0) {
      expect(Number(fila.total_anos_apn)).toBeGreaterThanOrEqual(minimo - 1e-4);
    }
  }
});
