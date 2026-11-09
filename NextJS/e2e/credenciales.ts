/** Credenciales E2E solo por entorno (R15): nunca valores por defecto en el repositorio. */
import type { Page } from "@playwright/test";
import { iniciarSesionComo } from "./inicio-sesion";

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable ${nombre} (ver e2e/README o .env.test.local).`);
  return valor;
}

export const EMAIL = requerida("E2E_ADMIN_EMAIL");
export const PASSWORD = requerida("E2E_ADMIN_PASSWORD");

export async function iniciarSesionE2E(page: Page): Promise<void> {
  await iniciarSesionComo(page, EMAIL, PASSWORD);
}
