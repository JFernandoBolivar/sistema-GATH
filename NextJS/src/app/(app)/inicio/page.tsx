"use client";
import Loading from "@/shared/ui/components/loading";
import CambiarPasswordDialog from "@/modules/auth/ui/cambiar-password-dialog";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect } from "react";

const MODULOS = [
  { href: "/usuarios", label: "Identidad / Usuarios", desc: "Gestión de cuentas y permisos" },
  { href: "/personal", label: "Personal", desc: "Empleados activos" },
  { href: "/cargos", label: "Cargos", desc: "Asignación y vacantes" },
  { href: "/familiares", label: "Cargas familiares", desc: "Familiares de empleados" },
  { href: "/organizacion", label: "Organización", desc: "Estructura organizacional" },
  { href: "/movimientos", label: "Movimientos", desc: "Historial de movimientos de cargo" },
  { href: "/pasivos", label: "Pasivos", desc: "Jubilados y pensionados" },
  { href: "/carnetizacion", label: "Carnetización", desc: "Carnets y plantillas" },
  { href: "/autogestion", label: "Autogestión", desc: "Censo de vivienda" },
  { href: "/reportes", label: "Reportes", desc: "Personal, pasivos y vacantes" },
  { href: "/catalogos", label: "Catálogos", desc: "Catálogos de solo lectura" },
];

/** Inicio de la arquitectura nueva (F8): reemplaza el selector de departamento de dashboard/page.tsx. */
export default function InicioPage() {
  const { data: session, status, update: updateSession } = useSession();

  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    if (session?.user?.debeCambiarPassword) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- abre el diálogo cuando la sesión (asíncrona) lo exige
      setShowChangePassword(true);
    }
  }, [session?.user?.debeCambiarPassword]);

  if (status === "loading") {
    return <Loading promiseMessage="Cargando Sesion" />;
  }

  return (
    <section className="flex flex-col gap-6 px-6 py-8">
      <header className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Sistema de Información Integral</h1>
        <p className="text-muted-foreground">Seleccione un módulo para acceder a sus funciones</p>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="flex flex-col gap-1 rounded-lg border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:bg-accent/50"
          >
            <span className="font-medium">{m.label}</span>
            <span className="text-sm text-muted-foreground">{m.desc}</span>
          </Link>
        ))}
      </div>

      <CambiarPasswordDialog
        open={showChangePassword}
        onCambiada={() => {
          updateSession({ debeCambiarPassword: false });
          setShowChangePassword(false);
        }}
      />
    </section>
  );
}
