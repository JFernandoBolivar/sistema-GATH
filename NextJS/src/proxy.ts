import { auth as proxy } from "../auth";
import { NextResponse } from "next/server";
import { puedeVerRuta } from "@/shared/lib/evaluador-iam";
import { urlDePeticion } from "@/shared/lib/origen-peticion";

/**
 * Destino de una redirección con el origen REAL de la petición
 * (`x-forwarded-host`/`x-forwarded-proto`), no el fijo de `NEXTAUTH_URL`:
 * detrás de un túnel o de otro dominio, un redirect a localhost rompe la sesión.
 */
function destino(req: { headers: Headers; nextUrl: URL }, ruta: string): URL {
  return urlDePeticion(req.headers, ruta) ?? new URL(ruta, req.nextUrl);
}

// Se usa `auth` de ../auth (con los callbacks jwt/session): con `NextAuth(authConfig)`
// a secas la sesión del proxy no incluía `permisos` ni `role`, y el perfil de
// autogestión nunca se detectaba.
const publicRoutes = ["/", "/login", "/register", "/recuperar-password", "/restablecer-password", "/offline"];

const PREFIJO_VERIFICACION_PUBLICA = "/fe-de-vida/verificar/";
const PREFIJO_VERIFICACION_CARNET = "/carnet/";

export default proxy((req) => {
  const { nextUrl, auth } = req;
  const isLoggedIn = !!auth?.user;
  const permisos = auth?.user?.permisos;

  // El dashboard es la pantalla principal (G7); /inicio solo redirige enlaces
  // antiguos. La tabla ruta → permiso vive en `evaluador-iam.ts`.
  const RUTA_INICIO = "/dashboard";
  const RUTA_LEGADA_INICIO = "/inicio";
  // Página legada del censo de vivienda (G12): el censo vigente es el del portal
  // de autogestión. Se conserva la URL como redirección para enlaces antiguos.
  const RUTA_LEGADA_CENSO = "/censo-vivienda";
  const RUTA_CENSO_VIGENTE = "/autogestion/censo";

  if (nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Proxy de archivos autenticados (src/app/api/v1): el Route Handler responde
  // 401 sin cookie y Django valida el token; no se redirige a /login ni se
  // aplica el filtrado de rutas por perfil (autogestión necesita su foto).
  if (nextUrl.pathname.startsWith("/api/v1/")) {
    return NextResponse.next();
  }

  // Verificación pública de la constancia de fe de vida (QR del documento impreso): la abre
  // cualquiera, con o sin sesión y sea cual sea su perfil. Solo este prefijo, ninguna otra ruta.
  if (nextUrl.pathname.startsWith(PREFIJO_VERIFICACION_PUBLICA)) {
    return NextResponse.next();
  }

  // Ficha pública del carnet (QR del anverso/reverso): se abre sin sesión.
  // Con sesión, la propia ficha eleva el nivel de detalle; sin sesión muestra
  // solo lo que el titular autorizó como público.
  if (nextUrl.pathname.startsWith(PREFIJO_VERIFICACION_CARNET)) {
    return NextResponse.next();
  }

  if (!publicRoutes.includes(nextUrl.pathname) && !isLoggedIn) {
    const login = new URL("/login", nextUrl);
    login.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`);
    return NextResponse.redirect(destino(req, `${login.pathname}${login.search}`));
  }

  // Enlaces y marcadores antiguos de /inicio (G7 corregido): el inicio es /dashboard.
  if (nextUrl.pathname === RUTA_LEGADA_INICIO) {
    return NextResponse.redirect(destino(req, RUTA_INICIO));
  }

  // Enlaces y marcadores del censo legado fuera del portal (G12).
  if (nextUrl.pathname === RUTA_LEGADA_CENSO) {
    return NextResponse.redirect(destino(req, RUTA_CENSO_VIGENTE));
  }

  // G13: el censo de vivienda (respuestas y métricas) vive en Gestión de
  // Trabajadores; las rutas antiguas de autogestión redirigen a su nuevo lugar.
  if (nextUrl.pathname === '/autogestion/consultar') {
    return NextResponse.redirect(destino(req, `/personal/censo/respuestas${nextUrl.search}`));
  }
  if (nextUrl.pathname === '/autogestion/metricas') {
    return NextResponse.redirect(destino(req, `/personal/censo/metricas${nextUrl.search}`));
  }

  if (publicRoutes.includes(nextUrl.pathname) && isLoggedIn) {
    // Todos los perfiles (también el trabajador) entran por el dashboard.
    return NextResponse.redirect(destino(req, RUTA_INICIO));
  }

  // D1: una ruta sin permiso redirige al dashboard (sin aviso). Si el único
  // bloqueo es la CONDICIÓN del trabajador (p. ej. un enlace de fe de vida de
  // pasivo abierto por una sesión activa), se permite la entrada: la página y
  // el backend ya limitan los datos a la cédula de la sesión (Zero-IDOR).
  const condicion = auth?.user?.condicionTrabajador;
  const permitido = puedeVerRuta(permisos, nextUrl.pathname, condicion);
  const permitidoPorPermiso = puedeVerRuta(permisos, nextUrl.pathname, condicion, true);
  if (isLoggedIn && !permitido && permitidoPorPermiso) {
    return NextResponse.next();
  }
  if (isLoggedIn && !permitido) {
    return NextResponse.redirect(destino(req, RUTA_INICIO));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
