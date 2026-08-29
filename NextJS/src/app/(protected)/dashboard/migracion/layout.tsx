import Link from "next/link";
import { Boxes } from "lucide-react";

const SECCIONES = [
  { href: "/dashboard/migracion/identidad", label: "Identidad / Usuarios" },
  { href: "/dashboard/migracion/personal", label: "Personal" },
  { href: "/dashboard/migracion/cargos", label: "Cargos" },
  { href: "/dashboard/migracion/familias", label: "Cargas familiares" },
  { href: "/dashboard/migracion/organizacion", label: "Organización" },
  { href: "/dashboard/migracion/movimientos", label: "Movimientos" },
  { href: "/dashboard/migracion/pasivos", label: "Pasivos" },
  { href: "/dashboard/migracion/carnetizacion", label: "Carnetización" },
  { href: "/dashboard/migracion/autogestion", label: "Autogestión" },
  { href: "/dashboard/migracion/reportes", label: "Reportes" },
  { href: "/dashboard/migracion/catalogos", label: "Catálogos" },
];

/** Layout del grupo de páginas migradas de la arquitectura nueva (R10). */
export default function MigracionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full">
      <nav
        aria-label="Módulos migrados"
        className="flex w-60 shrink-0 flex-col gap-1 border-r border-border bg-muted/30 px-3 py-6"
      >
        <div className="mb-4 flex items-center gap-2 px-2 text-sm font-semibold">
          <Boxes className="size-4" aria-hidden="true" />
          Módulos nuevos
        </div>
        {SECCIONES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
