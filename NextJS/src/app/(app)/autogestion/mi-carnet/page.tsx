import MiExpedienteView from "@/modules/autogestion/ui/mi-expediente-view";

/** Acceso directo a la pestaña «Mi carnet» de la ficha de autogestión. */
export default function MiCarnetPage() {
  return <MiExpedienteView initialTab="carnet" />;
}
