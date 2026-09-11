"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Home } from "lucide-react";
import { SignOut } from "@/components/signout-button";

const SECCIONES = [
  { href: "/inicio", label: "Inicio" },
  { href: "/usuarios", label: "Identidad / Usuarios" },
  { href: "/personal", label: "Personal" },
  { href: "/cargos", label: "Cargos" },
  { href: "/familiares", label: "Cargas familiares" },
  { href: "/organizacion", label: "Organización" },
  { href: "/movimientos", label: "Movimientos" },
  { href: "/pasivos", label: "Pasivos" },
  { href: "/carnetizacion", label: "Carnetización" },
  { href: "/autogestion", label: "Autogestión" },
  { href: "/reportes", label: "Reportes" },
  { href: "/catalogos", label: "Catálogos" },
];

/** Navegación del grupo `(app)` (arquitectura Onion, R10). */
export function AppNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Módulos"
      className="flex w-60 shrink-0 flex-col gap-1 border-r border-border bg-muted/30 px-3 py-6"
    >
      <div className="mb-4 flex items-center gap-2 px-2 text-sm font-semibold">
        <Boxes className="size-4" aria-hidden="true" />
        GATH
      </div>
      {SECCIONES.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          aria-current={pathname === s.href ? "page" : undefined}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
        >
          {s.href === "/inicio" && <Home className="size-3.5" aria-hidden="true" />}
          {s.label}
        </Link>
      ))}
      <div className="mt-4 px-2">
        <SignOut />
      </div>
    </nav>
  );
}
