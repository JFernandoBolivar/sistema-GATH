import { DetalleSolicitudView } from "@/modules/presupuesto/ui/views/detalle-solicitud-view";

export const metadata = {
  title: "Solicitud de Presupuesto",
  description: "Reserva de puesto, disponibilidad presupuestaria y Punto de Cuenta.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <DetalleSolicitudView expedienteId={id} />;
}
