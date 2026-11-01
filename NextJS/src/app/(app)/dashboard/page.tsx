"use client";

/**
 * Dashboard principal de GATH (restaurado de `(protected)/dashboard/page.tsx`
 * tras el error de G7). Es el selector de módulos del sistema, con tarjetas e
 * imágenes por módulo.
 *
 * Solo se muestran los módulos de primer nivel: Administración del sistema,
 * Gestión de Trabajadores, Carnetización y Autogestión. Cargos, Familiares,
 * Organización, Movimientos, Pasivos, Reportes y Catálogos viven dentro del
 * módulo Gestión de Trabajadores y no son tarjetas del dashboard.
 *
 * Los módulos se muestran por PERMISO (`tienePermiso`, R16), no por rol ni
 * departamento. Conserva el diálogo obligatorio de cambio de contraseña.
 */
import { SignOut } from "@/components/signout-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import Loading from "@/shared/ui/components/loading";
import { useEffect, useState } from "react";

import CambiarPasswordDialog from "@/modules/auth/ui/cambiar-password-dialog";

type Modulo = {
  id: string;
  name: string;
  imageSrc: string;
  href: string;
  alt: string;
  /** Permiso requerido para ver el módulo (R16: por código, no por rol). */
  permiso: string;
};

const MODULOS: Modulo[] = [
  {
    id: "Administracion",
    name: "Administración del sistema",
    imageSrc: "/images/departments/seguridad.jpg",
    href: "/usuarios",
    alt: "Administración del sistema",
    permiso: "identidad.ver_usuarios",
  },
  {
    id: "RAC",
    name: "Gestión de Trabajadores",
    imageSrc: "/images/departments/datos.jpg",
    href: "/personal",
    alt: "Gestión de trabajadores",
    permiso: "personal.ver",
  },
  {
    id: "Carnetizacion",
    name: "Carnetización",
    imageSrc: "/images/departments/carnetizacion.png",
    href: "/carnetizacion",
    alt: "Sistema de carnetización",
    permiso: "carnetizacion.ver",
  },
  {
    id: "AUTOGESTION",
    name: "Autogestión",
    imageSrc: "/images/departments/datos.jpg",
    href: "/autogestion",
    alt: "Autogestión de personal",
    permiso: "autogestion.ver_propio",
  },
];

export default function Dashboard() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const avisoSinPermiso = searchParams.get("aviso") === "sin-permiso";
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    if (session?.user?.debeCambiarPassword) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- abre el diálogo cuando la sesión (asíncrona) lo exige
      setShowChangePassword(true);
    }
  }, [session?.user?.debeCambiarPassword]);

  if (status === "loading") {
    return <Loading promiseMessage="Cargando Sesión" />;
  }

  return (
    <>
      <div className="mb-10 mt-4 flex flex-col items-center">
        <h1 className="mb-2 text-center text-3xl font-bold text-white">
          Sistema de Información Integral
        </h1>
        <p className="text-center text-2xl text-white">
          Seleccione un módulo para acceder a sus funciones
        </p>
        <SignOut />
      </div>
      {avisoSinPermiso && (
        <p
          role="alert"
          className="mx-8 mb-4 rounded-md border border-amber-300 bg-warning-soft p-3 text-center text-sm text-warning"
        >
          No tiene permiso para acceder a esa sección. Se le redirigió al inicio.
        </p>
      )}
      <div
        id="dashboard-modulos"
        data-testid="dashboard-modulos"
        className="mx-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
      >
        {MODULOS.filter((modulo) => tienePermiso(session?.user?.permisos, modulo.permiso)).map(
          (modulo) => (
            <Card
              key={modulo.id}
              onClick={() => router.push(modulo.href)}
              className="block cursor-pointer p-0 transition-all duration-200 hover:scale-105"
            >
              <div
                dir="rtl"
                className="relative end-0 top-4 z-10 w-fit rounded-full bg-green-700 p-1 text-white"
              >
                <Check size={18} aria-hidden="true" />
              </div>
              <Image
                height={150}
                width={100}
                src={modulo.imageSrc}
                alt={modulo.alt}
                className="relative h-60 w-full overflow-hidden object-contain"
              />
              <Card className="rounded bg-muted/25 text-center">
                <CardHeader>
                  <CardTitle className="text-xl">{modulo.name}</CardTitle>
                </CardHeader>
                <CardContent className="h-full text-center">
                  <p className="text-sm text-muted-foreground">Tienes acceso a este módulo.</p>
                </CardContent>
              </Card>
            </Card>
          ),
        )}
      </div>

      <CambiarPasswordDialog
        open={showChangePassword}
        onCambiada={() => {
          updateSession({ debeCambiarPassword: false });
          setShowChangePassword(false);
        }}
      />
    </>
  );
}
