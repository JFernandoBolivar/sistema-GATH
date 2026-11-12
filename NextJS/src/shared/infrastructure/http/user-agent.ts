/**
 * User-Agent real del navegador para las llamadas de servidor a Django.
 *
 * Next llama a Django desde el servidor: sin reenviar la cabecera, Django ve el
 * User-Agent de node y la bitácora de auditoría registra un dispositivo
 * equivocado. Solo se lee dentro de una petición; fuera, no se envía nada.
 */
import { headers } from "next/headers";

const MAX_LARGO = 255;

export async function userAgentDelCliente(): Promise<string | null> {
  try {
    const valor = (await headers()).get("user-agent");
    return valor ? valor.slice(0, MAX_LARGO) : null;
  } catch {
    // Fuera de una petición (build, scripts): no se envía la cabecera.
    return null;
  }
}
