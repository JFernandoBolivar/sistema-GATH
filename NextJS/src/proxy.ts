import NextAuth from "next-auth";
import authConfig from "../auth.config";
import { NextResponse } from "next/server";
import { tienePermiso } from "@/shared/lib/evaluador-iam";

const { auth: proxy } = NextAuth(authConfig);

const publicRoutes = [
  "/",
  "/login",
  "/register",
  "/recuperar-password",
  "/restablecer-password",
];

export default proxy((req) => {
  const { nextUrl, auth } = req;
  const isLoggedIn = !!auth?.user;
  const permisos = auth?.user?.permisos;

  const esAutogestion =
    auth?.user?.role?.nombre_rol === "AUTOGESTION" ||
    auth?.user?.department?.nombre_departamento === "AUTOGESTION" ||
    (tienePermiso(permisos, "autogestion.censo") && !tienePermiso(permisos, "personal.ver"));

  const esRecepcionista =
    auth?.user?.role?.nombre_rol === "RECEPCIONISTA" ||
    (tienePermiso(permisos, "personal.ver") && !tienePermiso(permisos, "personal.crear"));

  // Rutas que puede abrir un recepcionista / usuario de solo lectura.
  // El legado de "empleado"/"pasivo"/"familiares" (listado + detalle) ya se
  // retiró por completo (CC-APP-2026-08-001: modules/personal y
  // modules/pasivos cubren consulta + detalle con permisos
  // personal.ver_detalle/pasivos.ver que este rol ya tiene, y ocultan la
  // exportación de PDF que el CC exige restringir; modules/familiares ya
  // tiene gating de permisos -- oculta editar/eliminar sin
  // familiares.editar/eliminar, que este rol no tiene -- y una vista de
  // detalle equivalente a la del legado), por lo que se redirige a los
  // módulos nuevos. "/dashboard" se conserva como shell/selector de inicio
  // (aún no tiene equivalente en la arquitectura nueva).
  const RUTAS_RECEPCIONISTA = [
    "/dashboard",
    "/personal",
    "/pasivos",
    "/familiares",
    "/familiares/consultar",
  ];

  if (nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (!publicRoutes.includes(nextUrl.pathname) && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (publicRoutes.includes(nextUrl.pathname) && isLoggedIn) {
    if (esAutogestion) {
      return NextResponse.redirect(new URL("/autogestion", nextUrl));
    }
    if (esRecepcionista) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
    return NextResponse.redirect(new URL("/inicio", nextUrl));
  }

  if (isLoggedIn && esAutogestion) {
    if (
      !nextUrl.pathname.startsWith("/autogestion") &&
      !nextUrl.pathname.startsWith("/api/auth")
    ) {
      return NextResponse.redirect(new URL("/autogestion", nextUrl));
    }
  }

  if (isLoggedIn && esRecepcionista) {
    const ruta =
      nextUrl.pathname.length > 1
        ? nextUrl.pathname.replace(/\/+$/, "")
        : nextUrl.pathname;

    const permitida =
      RUTAS_RECEPCIONISTA.includes(ruta) || ruta.startsWith("/api/auth");

    if (!permitida) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
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
