import {
  Bell,
  CreditCard,
  FilePenLine,
  HeartPulse,
  Home,
  ListChecks,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { CondicionTrabajador } from "@/shared/lib/evaluador-iam";
import { filtrarMenuPorPermisos } from "@/shared/lib/permiso-menu";

export interface ItemNavAutogestion {
  id: string;
  etiqueta: string;
  href: string;
  icono: LucideIcon;
  /** Permiso por código requerido (nunca el nombre del rol). */
  permiso?: string;
  /** Condición del trabajador exigida (el backend la vuelve a validar). */
  condicion?: CondicionTrabajador;
  /** Solo visible si la configuración habilita solicitudes para la condición (O12). */
  requiereAutogestionHabilitada?: boolean;
  /** `true`: en móvil va al menú «Más» y no a la barra inferior. */
  secundario?: boolean;
  /** Coincidencia exacta de ruta (Inicio) en lugar de por prefijo. */
  exacto?: boolean;
  /** Rutas hijas que pertenecen a OTRO ítem y no deben marcar este como activo. */
  excluir?: string[];
}

/** Destinos de Autogestión, con etiquetas en lenguaje del usuario (PLAN_REDISENO §3.1). */
export const ITEMS_NAV_AUTOGESTION: ItemNavAutogestion[] = [
  { id: "inicio", etiqueta: "Inicio", href: "/autogestion", icono: Home, exacto: true },
  {
    id: "ficha",
    etiqueta: "Mi ficha",
    href: "/autogestion/ficha",
    icono: UserRound,
    permiso: "autogestion.ver_propio",
  },
  {
    id: "mi-carnet",
    etiqueta: "Mi carnet",
    href: "/autogestion/mi-carnet",
    icono: CreditCard,
    permiso: "autogestion.ver_propio",
  },
  {
    id: "solicitar",
    etiqueta: "Solicitar actualización",
    href: "/autogestion/solicitudes/nueva",
    icono: FilePenLine,
    permiso: "autogestion.solicitar_actualizacion",
    requiereAutogestionHabilitada: true,
  },
  {
    id: "solicitudes",
    etiqueta: "Mis solicitudes",
    href: "/autogestion/solicitudes",
    icono: ListChecks,
    permiso: "autogestion.ver_propio",
    requiereAutogestionHabilitada: true,
    excluir: ["/autogestion/solicitudes/nueva"],
  },
  {
    id: "fe-de-vida",
    etiqueta: "Fe de vida",
    href: "/autogestion/fe-de-vida",
    icono: HeartPulse,
    permiso: "fe_de_vida.solicitar",
    condicion: "PASIVO",
  },
  {
    id: "notificaciones",
    etiqueta: "Notificaciones",
    href: "/autogestion/notificaciones",
    icono: Bell,
    permiso: "notificaciones.ver_propias",
    secundario: true,
  },
  {
    id: "censo",
    etiqueta: "Censo de vivienda",
    href: "/autogestion/censo",
    icono: Home,
    permiso: "autogestion.censo_ver_propio",
    condicion: "ACTIVO",
    secundario: true,
  },
];

/** Destinos visibles para la sesión: permiso por código + condición del trabajador. */
export function itemsVisibles(
  permisos: string[] | null | undefined,
  condicionTrabajador: string | null | undefined,
  opciones: { autogestionHabilitada?: boolean } = {},
  items: ItemNavAutogestion[] = ITEMS_NAV_AUTOGESTION,
): ItemNavAutogestion[] {
  const visibles = filtrarMenuPorPermisos(items, permisos, condicionTrabajador);
  if (opciones.autogestionHabilitada === false) {
    return visibles.filter((item) => !item.requiereAutogestionHabilitada);
  }
  return visibles;
}

/** Ruta activa: por prefijo, salvo los ítems de coincidencia exacta. */
export function itemActivo(item: ItemNavAutogestion, pathname: string): boolean {
  const ruta = pathname.replace(/\/+$/, "") || "/";
  if (item.exacto) return ruta === item.href;
  if (item.excluir?.some((e) => ruta === e || ruta.startsWith(`${e}/`))) return false;
  return ruta === item.href || ruta.startsWith(`${item.href}/`);
}
