import NextAuth from "next-auth";
import authConfig from "../auth.config";
import { NextResponse } from "next/server";
import { puede } from "@/shared/lib/evaluador-iam";

const { auth: proxy } = NextAuth(authConfig);

const publicRoutes = ["/", "/login", "/register"];

export default proxy((req) => {
  const { nextUrl, auth } = req;
  const isLoggedIn = !!auth?.user;
  const permisos = auth?.user?.permisos;

  const esAutogestion =
    auth?.user?.role?.nombre_rol === "AUTOGESTION" ||
    auth?.user?.department?.nombre_departamento === "AUTOGESTION" ||
    (puede(permisos, "autogestion.censo") && !puede(permisos, "personal.ver"));

  const esRecepcionista =
    auth?.user?.role?.nombre_rol === "RECEPCIONISTA" ||
    (puede(permisos, "personal.ver") && !puede(permisos, "personal.crear"));

  // Rutas que puede abrir un recepcionista / usuario de solo lectura.
  // El lado "pasivos" del legado ya se retiró (modules/pasivos cubre
  // consulta + detalle + PDF con el mismo permiso pasivos.ver que ya
  // tiene este rol), por lo que se redirige al módulo nuevo. El lado
  // "personal" del legado permanece hasta resolver si personal.ver_detalle
  // se otorga a RECEPCIONISTA (ver AUDITORIA/LIMPIEZA_FINAL_LEGADO).
  const RUTAS_RECEPCIONISTA = [
    "/dashboard",
    "/dashboard/gestion-trabajadores",
    "/dashboard/gestion-trabajadores/personal-trabajador/consultar",
    "/dashboard/gestion-trabajadores/personal-trabajador/familiares/consultar",
    "/pasivos",
  ];

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
