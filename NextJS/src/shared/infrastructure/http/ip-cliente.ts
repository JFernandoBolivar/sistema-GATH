/**
 * IP real del visitante para las llamadas de servidor a servidor (F2-05).
 *
 * Next llama a Django desde el servidor, así que Django vería la IP del
 * contenedor de Next y el throttling por IP quedaría inutilizado (todos los
 * visitantes comparten un cupo).
 *
 * Solo se confía en lo que pone el proxy de entrada (nginx), nunca en lo que
 * manda el navegador:
 * - `x-real-ip` primero: nginx la fija con `$remote_addr` y el cliente no puede
 *   falsificarla.
 * - si no existe, el ÚLTIMO valor de `x-forwarded-for` (el que añade el proxy
 *   inmediatamente anterior). El primero lo puede inventar el cliente para
 *   saltarse el límite de intentos.
 * El valor se valida como IP antes de reenviarlo.
 *
 * Solo tiene efecto si Django confía en la cabecera: `DJANGO_NUM_PROXIES`
 * debe coincidir con la cadena de proxies delante de Django.
 */
import { headers } from "next/headers";

const IP_VALIDA = /^[0-9a-fA-F:.]{2,45}$/;

export function elegirIp(realIp: string | null, reenviada: string | null): string | null {
  const real = realIp?.trim();
  if (real && IP_VALIDA.test(real)) return real;
  const ultima = reenviada?.split(",").map((v) => v.trim()).filter(Boolean).pop();
  return ultima && IP_VALIDA.test(ultima) ? ultima : null;
}

export async function ipDelCliente(): Promise<string | null> {
  try {
    const cabeceras = await headers();
    return elegirIp(cabeceras.get("x-real-ip"), cabeceras.get("x-forwarded-for"));
  } catch {
    // Fuera de una petición (build, scripts): sin IP, no se envía la cabecera.
    return null;
  }
}
