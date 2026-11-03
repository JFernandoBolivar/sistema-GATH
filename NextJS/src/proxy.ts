import { auth as proxy } from "../auth";
import { NextResponse } from "next/server";
import { puedeVerRuta } from "@/shared/lib/evaluador-iam";

// Se usa `auth` de ../auth (con los callbacks jwt/session): con `NextAuth(authConfig)`
// a secas la sesión del proxy no incluía `permisos` ni `role`, y el perfil de
// autogestión nunca se detectaba.
const publicRoutes = ["/", "/login", "/register", "/recuperar-password", "/restablecer-password", "/offline"];

const PREFIJO_VERIFICACION_PUBLICA = "/fe-de-vida/verificar/";

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

  if (!publicRoutes.includes(nextUrl.pathname) && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Enlaces y marcadores antiguos de /inicio (G7 corregido): el inicio es /dashboard.
  if (nextUrl.pathname === RUTA_LEGADA_INICIO) {
    return NextResponse.redirect(new URL(RUTA_INICIO, nextUrl));
  }

  // Enlaces y marcadores del censo legado fuera del portal (G12).
  if (nextUrl.pathname === RUTA_LEGADA_CENSO) {
    return NextResponse.redirect(new URL(RUTA_CENSO_VIGENTE, nextUrl));
  }

  // G13: el censo de vivienda (respuestas y métricas) vive en Gestión de
  // Trabajadores; las rutas antiguas de autogestión redirigen a su nuevo lugar.
  if (nextUrl.pathname === '/autogestion/consultar') {
    return NextResponse.redirect(new URL(`/personal/censo/respuestas${nextUrl.search}`, nextUrl));
  }
  if (nextUrl.pathname === '/autogestion/metricas') {
    return NextResponse.redirect(new URL(`/personal/censo/metricas${nextUrl.search}`, nextUrl));
  }

  if (publicRoutes.includes(nextUrl.pathname) && isLoggedIn) {
    // Todos los perfiles (también el trabajador) entran por el dashboard.
    return NextResponse.redirect(new URL(RUTA_INICIO, nextUrl));
  }

  // D1: una ruta sin permiso redirige al dashboard con aviso (nunca a una
  // página rota). La tabla ruta → permiso vive en `evaluador-iam.ts`; ningún
  // perfil tiene listas de rutas propias ni compara nombres de rol.
  if (
    isLoggedIn &&
    !puedeVerRuta(permisos, nextUrl.pathname, auth?.user?.condicionTrabajador)
  ) {
    return NextResponse.redirect(new URL(`${RUTA_INICIO}?aviso=sin-permiso`, nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
