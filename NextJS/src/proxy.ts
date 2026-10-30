import { auth as proxy } from "../auth";
import { NextResponse } from "next/server";
import { esPerfilAutogestion, esPerfilRecepcionista } from "@/shared/lib/perfil-acceso";

// Se usa `auth` de ../auth (con los callbacks jwt/session): con `NextAuth(authConfig)`
// a secas la sesión del proxy no incluía `permisos` ni `role`, y los perfiles de
// autogestión/recepcionista nunca se detectaban.
const publicRoutes = ["/", "/login", "/register", "/recuperar-password", "/restablecer-password"];

const PREFIJO_VERIFICACION_PUBLICA = "/fe-de-vida/verificar/";

export default proxy((req) => {
  const { nextUrl, auth } = req;
  const isLoggedIn = !!auth?.user;
  const permisos = auth?.user?.permisos;

  // Perfiles derivados de permisos por código (R16), no del nombre del rol.
  const esAutogestion = esPerfilAutogestion(permisos);
  const esRecepcionista = esPerfilRecepcionista(permisos);

  // Rutas que puede abrir un recepcionista / usuario de solo lectura.
  // El legado de "empleado"/"pasivo"/"familiares" (listado + detalle) ya se
  // retiró por completo (CC-APP-2026-08-001: modules/personal y
  // modules/pasivos cubren consulta + detalle con permisos
  // personal.ver_detalle/pasivos.ver que este rol ya tiene, y ocultan la
  // exportación de PDF que el CC exige restringir; modules/familiares ya
  // tiene gating de permisos -- oculta editar/eliminar sin
  // familiares.editar/eliminar, que este rol no tiene -- y una vista de
  // detalle equivalente a la del legado), por lo que se redirige a los
  // módulos nuevos. El shell legado "/dashboard" se retiró (G7): ahora es una
  // redirección a "/inicio", el selector de inicio de la arquitectura nueva.
  const RUTA_INICIO = "/inicio";
  const RUTA_LEGADA_DASHBOARD = "/dashboard";

  // Rutas que puede abrir un recepcionista / usuario de solo lectura.
  const RUTAS_RECEPCIONISTA = [
    RUTA_INICIO,
    "/personal",
    "/pasivos",
    "/familiares",
    "/familiares/consultar",
  ];

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

  // Enlaces y marcadores del shell legado `(protected)/dashboard` (G7).
  if (nextUrl.pathname === RUTA_LEGADA_DASHBOARD) {
    return NextResponse.redirect(new URL(RUTA_INICIO, nextUrl));
  }

  if (publicRoutes.includes(nextUrl.pathname) && isLoggedIn) {
    if (esAutogestion) {
      return NextResponse.redirect(new URL("/autogestion", nextUrl));
    }
    if (esRecepcionista) {
      return NextResponse.redirect(new URL(RUTA_INICIO, nextUrl));
    }
    return NextResponse.redirect(new URL("/inicio", nextUrl));
  }

  if (isLoggedIn && esAutogestion) {
    if (!nextUrl.pathname.startsWith("/autogestion") && !nextUrl.pathname.startsWith("/api/auth")) {
      return NextResponse.redirect(new URL("/autogestion", nextUrl));
    }
  }

  if (isLoggedIn && esRecepcionista) {
    const ruta =
      nextUrl.pathname.length > 1 ? nextUrl.pathname.replace(/\/+$/, "") : nextUrl.pathname;

    const permitida = RUTAS_RECEPCIONISTA.includes(ruta) || ruta.startsWith("/api/auth");

    if (!permitida) {
      return NextResponse.redirect(new URL(RUTA_INICIO, nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
