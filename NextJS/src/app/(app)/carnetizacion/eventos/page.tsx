import PageLayout from "@/components/layout/page-layout";
import { EventosListaView } from "@/modules/carnetizacion/ui/components/eventos/eventos-lista-view";

export const metadata = {
  title: "Eventos Institucionales | Carnetización",
  description: "Gestión integral de eventos institucionales, nómina de invitados, emisión de credenciales y control de acceso con QR.",
};

export default function EventosPage() {
  return (
    <PageLayout
      title="Eventos Institucionales"
      description="Gestión integral de eventos especiales, nómina de invitados, emisión masiva de gafetes y control de acceso QR."
    >
      <EventosListaView />
    </PageLayout>
  );
}
