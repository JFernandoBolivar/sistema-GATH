import {
  BarChart3,
  Bell,
  FileSpreadsheet,
  FilePenLine,
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
    id: "solicitar",
    etiqueta: "Solicitar actualización",
    href: "/autogestion/solicitudes/nueva",
    icono: FilePenLine,
    permiso: "autogestion.solicitar_actualizacion",
    condicion: "ACTIVO",
  },
  {
    id: "solicitudes",
    etiqueta: "Mis solicitudes",
    href: "/autogestion/solicitudes",
    icono: ListChecks,
    permiso: "autogestion.ver_propio",
    condicion: "ACTIVO",
    excluir: ["/autogestion/solicitudes/nueva"],
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
  {
    id: "encuesta",
    etiqueta: "Respuestas de encuesta",
    href: "/autogestion/consultar",
    icono: FileSpreadsheet,
    permiso: "autogestion.censo_ver_todos",
    secundario: true,
  },
  {
    id: "metricas",
    etiqueta: "Métricas",
    href: "/autogestion/metricas",
    icono: BarChart3,
    permiso: "autogestion.censo_ver_todos",
    secundario: true,
  },
];

/** Destinos visibles para la sesión: permiso por código + condición del trabajador. */
export function itemsVisibles(
  permisos: string[] | null | undefined,
  condicionTrabajador: string | null | undefined,
  items: ItemNavAutogestion[] = ITEMS_NAV_AUTOGESTION,
): ItemNavAutogestion[] {
  return filtrarMenuPorPermisos(items, permisos, condicionTrabajador);
}

/** Ruta activa: por prefijo, salvo los ítems de coincidencia exacta. */
export function itemActivo(item: ItemNavAutogestion, pathname: string): boolean {
  const ruta = pathname.replace(/\/+$/, "") || "/";
  if (item.exacto) return ruta === item.href;
  if (item.excluir?.some((e) => ruta === e || ruta.startsWith(`${e}/`))) return false;
  return ruta === item.href || ruta.startsWith(`${item.href}/`);
}
