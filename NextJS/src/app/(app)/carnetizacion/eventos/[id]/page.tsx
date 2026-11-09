import { EventoDetallePanel } from "@/modules/carnetizacion/ui/components/eventos/evento-detalle-panel";

export const metadata = {
  title: "Panel del Evento | Carnetización",
  description: "Métricas de asistencia, emisión de gafetes y control de acceso del evento.",
};

interface EventoPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventoPage({ params }: EventoPageProps) {
  const { id } = await params;
  return <EventoDetallePanel eventoId={id} />;
}
