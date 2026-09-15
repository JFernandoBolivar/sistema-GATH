"use server";

import fs from "node:fs/promises";
import path from "node:path";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "frontend-errors.log");

/**
 * Registra un error del frontend en dos lugares:
 * 1. Un archivo de texto plano local (logs/frontend-errors.log), para poder
 *    revisar rapido sin depender del backend.
 * 2. El endpoint de auditoria de Django (tabla audit_log compartida), asi
 *    queda junto a los eventos de login/logout/CRUD del backend.
 *
 * Nunca lanza: un fallo al registrar el error no debe generar otro error.
 */
export async function reportFrontendError(
  message: string,
  stack?: string,
  url?: string,
) {
  const line = `${new Date().toISOString()} ERROR url=${url ?? ""} message=${message} stack=${stack ?? ""}\n`;

  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.appendFile(LOG_FILE, line, "utf8");
  } catch {
    // Si no se puede escribir el archivo local, igual intentamos el backend.
  }

  try {
    await fetch(
      `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}accounts/frontend-error/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, stack, url }),
      },
    );
  } catch {
    // Sin conexion al backend: el registro local ya quedo guardado.
  }
}
