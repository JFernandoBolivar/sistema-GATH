"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Clock3,
  FileCheck,
  Palette,
  Printer,
  QrCode,
  UserCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSession } from "next-auth/react";

import PageLayout from "@/components/layout/page-layout";
import { tienePermiso } from "@/shared/lib/evaluador-iam";

interface SeccionCarnetizacion {
  titulo: string;
  descripcion: string;
  href: string;
  icono: LucideIcon;
  permiso?: string;
}

const SECCIONES: SeccionCarnetizacion[] = [
  {
    titulo: "Consola de Emisión",
    descripcion: "Busque al titular, revise su estado y emita el carnet con su plantilla.",
    href: "/carnetizacion/emision",
    icono: Printer,
    permiso: "carnetizacion.ver",
  },
  {
    titulo: "Solicitudes",
    descripcion: "Bandeja de solicitudes de Mi carnet, dictamen y emisión.",
    href: "/carnetizacion/solicitudes",
    icono: FileCheck,
    permiso: "carnetizacion.ver",
  },
  {
    titulo: "Eventos",
    descripcion: "Cree eventos, administre invitados y emita los gafetes de acceso.",
    href: "/carnetizacion/eventos",
    icono: CalendarDays,
    permiso: "carnetizacion.eventos",
  },
  {
    titulo: "Control de Entrada QR",
    descripcion: "Valide carnets de trabajadores y controle el ingreso a los eventos.",
    href: "/carnetizacion/control-eventos",
    icono: QrCode,
    permiso: "carnetizacion.control_eventos",
  },
  {
    titulo: "Plantillas",
    descripcion: "Diseñe, versione y active las plantillas del carnet institucional.",
    href: "/carnetizacion/plantillas",
    icono: Palette,
    permiso: "carnetizacion.disenar",
  },
  {
    titulo: "Visitantes",
    descripcion: "Credenciales de visita y contratistas con vigencia y devolución.",
    href: "/carnetizacion/visitantes",
    icono: UserCheck,
    permiso: "carnetizacion.visitantes",
  },
  {
    titulo: "Credencial temporal",
    descripcion: "Emisión corta para olvido o extravío del carnet del trabajador.",
    href: "/carnetizacion/temporal",
    icono: Clock3,
    permiso: "carnetizacion.temporal",
  },
  {
    titulo: "Impresión por lote",
    descripcion: "Genere varios carnets en una sola operación.",
    href: "/carnetizacion/lote",
    icono: Printer,
    permiso: "carnetizacion.lote",
  },
  {
    titulo: "Estadísticas",
    descripcion: "Indicadores de emisión, motivos y actividad de carnetización.",
    href: "/carnetizacion/estadisticas",
    icono: BarChart3,
    permiso: "carnetizacion.ver",
  },
];

export function CarnetizacionHome() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const secciones = SECCIONES.filter((s) => !s.permiso || tienePermiso(permisos, s.permiso));

  return (
    <PageLayout
      title="Carnetización"
      description="Emisión, solicitudes, eventos, control de acceso y plantillas en un solo lugar."
    >
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {secciones.map((seccion) => (
          <Link
            key={seccion.href}
            href={seccion.href}
            className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-11 items-center justify-center rounded-lg bg-secondary text-primary">
              <seccion.icono className="size-5" aria-hidden />
            </span>
            <h2 className="mt-4 text-base font-semibold text-foreground">{seccion.titulo}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{seccion.descripcion}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Abrir
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </Link>
        ))}
      </div>
    </PageLayout>
  );
}
