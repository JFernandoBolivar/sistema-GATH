/**
 * Origen real de una petición HTTP, pensado para túneles y proxies inversos.
 *
 * `x-forwarded-host` / `x-forwarded-proto` los fija el proxy con el dominio
 * público; `host` es el valor directo de la petición. Usar el origen real evita
 * redirigir a `localhost` cuando la app se sirve por un túnel o un dominio
 * distinto del configurado en el arranque.
 */

function primerValor(valor: string | null): string {
  return (valor ?? "").split(",")[0]?.trim() ?? "";
}

function hostSinPuerto(host: string): string {
  if (host.startsWith("[")) {
    const cierre = host.indexOf("]");
    return cierre === -1 ? host : host.slice(0, cierre + 1);
  }
  return host.split(":")[0] ?? host;
}

function esHostLocal(host: string): boolean {
  const nombre = hostSinPuerto(host).toLowerCase();
  return (
    nombre === "localhost" ||
    nombre === "127.0.0.1" ||
    nombre === "::1" ||
    nombre === "[::1]"
  );
}

/**
 * Devuelve `https://host` (o `http://` en local) a partir de las cabeceras, o
 * `null` si la petición no trae host.
 */
export function origenDeCabeceras(cabeceras: Headers): string | null {
  const host = primerValor(cabeceras.get("x-forwarded-host")) || primerValor(cabeceras.get("host"));
  if (!host) return null;

  const protoRecibido = primerValor(cabeceras.get("x-forwarded-proto")).toLowerCase();
  const protocolo =
    protoRecibido === "http" || protoRecibido === "https"
      ? protoRecibido
      : esHostLocal(host)
        ? "http"
        : "https";

  return `${protocolo}://${host}`;
}

/** Resuelve una ruta contra el origen real de la petición (o `null`). */
export function urlDePeticion(cabeceras: Headers, ruta: string): URL | null {
  const origen = origenDeCabeceras(cabeceras);
  return origen ? new URL(ruta, origen) : null;
}
