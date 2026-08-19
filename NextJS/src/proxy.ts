import NextAuth from "next-auth";
import authConfig from "../auth.config";
import { NextResponse } from "next/server";

const { auth: proxy } = NextAuth(authConfig);

const publicRoutes = ["/", "/login", "/register"];

export default proxy((req) => {
  const { nextUrl, auth } = req;
  const isLoggedIn = !!auth?.user;

  const esAutogestion =
    auth?.user?.role?.nombre_rol === "AUTOGESTION" ||
    auth?.user?.department?.nombre_departamento === "AUTOGESTION";

  const esRecepcionista = auth?.user?.role?.nombre_rol === "RECEPCIONISTA";

  // Rutas que puede abrir un recepcionista. Se comparan de forma EXACTA a
  // propósito: un prefijo como "/dashboard/gestion-trabajadores" dejaría pasar
  // también las pantallas de escritura del mismo módulo.
  const RUTAS_RECEPCIONISTA = [
    "/dashboard",
    "/dashboard/gestion-trabajadores",
    "/dashboard/gestion-trabajadores/personal-trabajador/consultar",
    "/dashboard/gestion-trabajadores/personal-trabajador/familiares/consultar",
    "/dashboard/gestion-pasivos",
    "/dashboard/gestion-pasivos/personal-jubilado/consultar",
    "/dashboard/gestion-pasivos/personal-jubilado/familiares/consultar",
  ];

  if (!publicRoutes.includes(nextUrl.pathname) && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (publicRoutes.includes(nextUrl.pathname) && isLoggedIn) {
    if (esAutogestion) {
      return NextResponse.redirect(new URL("/dashboard/autogestion", nextUrl));
    }
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  if (isLoggedIn && esAutogestion) {
    if (
      !nextUrl.pathname.startsWith("/dashboard/autogestion") &&
      !nextUrl.pathname.startsWith("/api/auth")
    ) {
      return NextResponse.redirect(new URL("/dashboard/autogestion", nextUrl));
    }
  }

  if (isLoggedIn && esRecepcionista) {
    // el header enlaza con barra final, así que se normaliza antes de comparar
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
