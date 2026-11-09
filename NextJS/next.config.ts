import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La imagen Docker (etapa runner) arranca con .next/standalone/server.js.
  output: "standalone",
  // No anunciar el framework en la cabecera X-Powered-By (caja negra 2026-11-03).
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  // Orígenes extra para el servidor de desarrollo (lista separada por comas).
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  // Correos y notificaciones de fe de vida enviados antes del 2026-11-03 enlazaban a
  // `/fe-de-vida` (no existe); se llevan a la pantalla real del pasivo. Solo la ruta
  // exacta: `/fe-de-vida/verificar/...` (verificación pública) no se toca.
  async redirects() {
    return [{ source: "/fe-de-vida", destination: "/autogestion/fe-de-vida", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // `camera=(self)` en toda la app: la navegación SPA conserva la
            // política del documento con el que se cargó la sesión, así que
            // acotarla a una ruta dejaba sin cámara a /personal/registrar, Mi
            // ficha o Carnetización tras navegar. El permiso real lo sigue
            // pidiendo el navegador; micrófono y geolocalización quedan denegados.
            value: "camera=(self), microphone=(), geolocation=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // CSP base sin tocar scripts ni estilos (no cambia el render): impide
          // incrustar la app en iframes ajenos, plugins (<object>/<embed>),
          // cambiar la <base> y enviar formularios a otros dominios. La CSP de
          // scripts con nonce queda como decisión aparte (ver plan 2026-11-03).
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
