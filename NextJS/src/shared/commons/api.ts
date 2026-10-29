/**
 * Constantes de conexión al backend Django (Server-Only).
 *
 * Se utiliza ÚNICAMENTE la variable de entorno `DJANGO_API_SERVER` (sin
 * prefijo `NEXT_PUBLIC_`, R15) para no exponer la IP del backend al bundle
 * del navegador. Las variables `NEXT_PUBLIC_*` se conservan SOLO como fallback
 * de compatibilidad durante la migración (F4) y desaparecen al retirar el
 * legado `api-client.ts` — no deben usarse en código nuevo.
 */

// Sin fallback en producción: un despliegue sin DJANGO_API_SERVER debe fallar de
// forma visible, no apuntar en silencio a localhost. Solo en desarrollo/test se
// asume el backend local.
const rawUrl =
  process.env.DJANGO_API_SERVER ||
  process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER ||
  process.env.NEXT_PUBLIC_DJANGO_API_URL ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:8000");

if (!rawUrl) {
  console.error("[api] Falta DJANGO_API_SERVER: no hay URL del backend Django configurada.");
}

// Normalizar la URL: eliminar barras finales y cualquier sufijo /api si existe
const sanitizedUrl = rawUrl
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

export const DJANGO_API_SERVER = `${sanitizedUrl}/`;

export const API_CONFIG = {
  baseUrl: DJANGO_API_SERVER,
  timeoutMs: 15000,
  apiVersion: "v1",
} as const;
