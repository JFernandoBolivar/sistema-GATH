"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { LayoutGrid, LogOut, Menu, Moon, Sun, type LucideIcon } from "lucide-react";
import { cerrarSesionAction } from "@/modules/auth/infrastructure/actions/auth-actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/components/sheet";
import { SkipLink } from "@/shared/ui/components/skip-link";
import { cn } from "@/lib/utils";
import { modulosAccesibles } from "@/shared/lib/evaluador-iam";
import { esPerfilAutogestion } from "@/shared/lib/perfil-acceso";
import { itemActivo, itemsVisibles, type ItemNavAutogestion } from "./nav-autogestion";
import { CampanaNotificaciones } from "@/modules/notificaciones/ui/campana-notificaciones";
import { ControlTamanoTexto } from "./control-tamano-texto";

const MAX_EN_BARRA = 4;

function EnlaceNav({
  item,
  activo,
  variante,
}: {
  item: { etiqueta: string; href: string; icono: LucideIcon };
  activo: boolean;
  variante: "lateral" | "inferior";
}) {
  const Icono = item.icono;
  return (
    <Link
      href={item.href}
      aria-current={activo ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg font-semibold transition-colors",
        variante === "lateral"
          ? "min-h-12 px-4 text-base"
          : "min-h-14 flex-1 flex-col justify-center gap-0.5 px-1 text-center text-xs leading-tight",
        activo
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <Icono
        className={variante === "lateral" ? "size-5 shrink-0" : "size-6 shrink-0"}
        aria-hidden
      />
      <span>{item.etiqueta}</span>
    </Link>
  );
}

/** Cierre de sesión con texto visible (la versión de solo ícono no tenía nombre accesible). */
function BotonSalir({ className }: { className?: string }) {
  const [saliendo, setSaliendo] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      disabled={saliendo}
      onClick={async () => {
        setSaliendo(true);
        await cerrarSesionAction();
        window.location.href = "/login";
      }}
    >
      <LogOut aria-hidden /> Cerrar sesión
    </Button>
  );
}

function AlternarTema() {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- evita el desajuste de hidratación del tema
  useEffect(() => setMontado(true), []);
  const oscuro = montado && resolvedTheme === "dark";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="text-white hover:bg-white/15 hover:text-white"
      aria-label={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      onClick={() => setTheme(oscuro ? "light" : "dark")}
    >
      {oscuro ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}

/**
 * Marco institucional de Autogestión: cabecera CONATEL con filete dorado, navegación lateral en
 * escritorio y barra inferior de 4-5 destinos en móvil. Los destinos salen de permisos por código y de
 * la condición del trabajador, nunca del nombre del rol.
 */
export function AutogestionShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname() ?? "";
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const condicion = session?.user?.condicionTrabajador;

  const visibles = useMemo(() => itemsVisibles(permisos, condicion), [permisos, condicion]);
  const principales = visibles.filter((i) => !i.secundario);
  const secundarios = visibles.filter((i) => i.secundario);
  const enBarra: ItemNavAutogestion[] = principales.slice(0, MAX_EN_BARRA);
  const enMas = [...principales.slice(MAX_EN_BARRA), ...secundarios];

  const otrosModulos = modulosAccesibles(permisos).some((m) => m !== "autogestion");
  const puedeVolverAModulos = otrosModulos && !esPerfilAutogestion(permisos);
  const [menuMasAbierto, setMenuMasAbierto] = useState(false);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SkipLink />
      <header className="sticky top-0 z-40 border-b-4 border-brand-gold bg-brand-deep text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-white/80">
              CONATEL · GATH
            </p>
            <p className="truncate text-lg font-bold leading-tight">Autogestión de Personal</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ControlTamanoTexto condicionTrabajador={condicion} />
            <CampanaNotificaciones variante="oscura" />
            <AlternarTema />
            <span className="mx-1 hidden h-6 w-px bg-white/30 sm:block" aria-hidden />
            <div className="hidden max-w-56 text-right sm:block">
              <p className="truncate text-sm font-semibold">{session?.user?.name ?? ""}</p>
              {session?.user?.cedula ? (
                <p className="text-xs text-white/80">C.I. {session.user.cedula}</p>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 pb-24 pt-6 sm:px-6 lg:pb-8">
        <nav aria-label="Navegación de Autogestión" className="hidden w-64 shrink-0 lg:block">
          <ul className="sticky top-28 flex flex-col gap-1">
            {visibles.map((item) => (
              <li key={item.id}>
                <EnlaceNav item={item} activo={itemActivo(item, pathname)} variante="lateral" />
              </li>
            ))}
            {puedeVolverAModulos ? (
              <li className="mt-2 border-t pt-2">
                <EnlaceNav
                  item={{ etiqueta: "Todos los módulos", href: "/inicio", icono: LayoutGrid }}
                  activo={false}
                  variante="lateral"
                />
              </li>
            ) : null}
            <li className="mt-2 border-t pt-3">
              <BotonSalir className="w-full justify-start" />
            </li>
          </ul>
        </nav>

        <main id="contenido-principal" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          {children}
        </main>
      </div>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="mx-auto flex max-w-xl items-stretch gap-1 py-1.5">
          {enBarra.map((item) => (
            <li key={item.id} className="flex flex-1">
              <EnlaceNav item={item} activo={itemActivo(item, pathname)} variante="inferior" />
            </li>
          ))}
          <li className="flex flex-1">
            <Sheet open={menuMasAbierto} onOpenChange={setMenuMasAbierto}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-xs font-semibold leading-tight text-foreground hover:bg-accent"
                >
                  <Menu className="size-6" aria-hidden />
                  <span>Más</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[80svh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Más opciones</SheetTitle>
                </SheetHeader>
                <ul className="flex flex-col gap-1 px-4 pb-4">
                  {enMas.map((item) => (
                    <li key={item.id} onClick={() => setMenuMasAbierto(false)}>
                      <EnlaceNav
                        item={item}
                        activo={itemActivo(item, pathname)}
                        variante="lateral"
                      />
                    </li>
                  ))}
                  {puedeVolverAModulos ? (
                    <li>
                      <EnlaceNav
                        item={{ etiqueta: "Todos los módulos", href: "/inicio", icono: LayoutGrid }}
                        activo={false}
                        variante="lateral"
                      />
                    </li>
                  ) : null}
                  <li className="mt-2 border-t pt-3">
                    <BotonSalir className="w-full justify-start" />
                  </li>
                </ul>
              </SheetContent>
            </Sheet>
          </li>
        </ul>
      </nav>
    </div>
  );
}
