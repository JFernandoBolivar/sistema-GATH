import Link from "next/link";
import { Boxes } from "lucide-react";

const SECCIONES = [
  { href: "/dashboard/migracion/identidad", label: "Identidad / Usuarios", desc: "Gestión de cuentas y permisos" },
  { href: "/dashboard/migracion/pasivos", label: "Pasivos", desc: "Jubilados y pensionados" },
  { href: "/dashboard/migracion/movimientos", label: "Movimientos", desc: "Historial de movimientos de cargo" },
  { href: "/dashboard/migracion/catalogos", label: "Catálogos", desc: "Catálogos de solo lectura" },
];

/** Índice de la sección de módulos migrados (R10 thin wrappers). */
export default function MigracionPage() {
  return (
    <section className="flex flex-col gap-6 px-6 py-8">
      <header className="flex items-center gap-2">
        <Boxes className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Módulos migrados a la arquitectura Onion</h1>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECCIONES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex flex-col gap-1 rounded-lg border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:bg-accent/50"
          >
            <span className="font-medium">{s.label}</span>
            <span className="text-sm text-muted-foreground">{s.desc}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
