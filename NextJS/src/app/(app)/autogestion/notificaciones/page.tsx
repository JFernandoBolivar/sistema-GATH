import BandejaNotificacionesPage from "@/modules/notificaciones/ui/bandeja-notificaciones-page";

/** Thin wrapper (R10): bandeja de notificaciones del módulo «autogestion» dentro de su propio layout. */
export default function Page() {
  return <BandejaNotificacionesPage modulo="autogestion" />;
}
