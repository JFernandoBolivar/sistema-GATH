import { EventosListaView } from "@/modules/carnetizacion/ui/components/eventos/eventos-lista-view";

export const metadata = {
  title: "Eventos y Asistentes | Carnetización",
  description: "Gestión de eventos institucionales, acreditación de invitados y control de acceso con QR.",
};

export default function EventosPage() {
  return <EventosListaView />;
}
