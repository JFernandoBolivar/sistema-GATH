/**
 * Política del atributo `Secure` de las cookies de sesión (`dj_access`,
 * `dj_refresh`). Solo servidor (sin prefijo `NEXT_PUBLIC_`, R15).
 *
 * `AUTH_COOKIE_SECURE=true|false` manda. Sin la variable, el default es seguro:
 * `Secure` en producción (coherente con `DJANGO_COOKIE_SECURE`, que en el
 * backend vale `not DEBUG`). Un despliegue servido por HTTP (por IP, sin TLS)
 * debe fijar `AUTH_COOKIE_SECURE=false` o el navegador descartará las cookies.
 */
export function authCookieSecure(env: NodeJS.ProcessEnv = process.env): boolean {
  const valor = env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (valor === "true" || valor === "1") return true;
  if (valor === "false" || valor === "0") return false;
  return env.NODE_ENV === "production";
}
