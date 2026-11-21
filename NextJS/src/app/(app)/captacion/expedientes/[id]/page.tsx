import { DetalleExpedienteView } from "@/modules/captacion/ui/views/detalle-expediente-view";

export const metadata = {
  title: "Expediente de postulante | Captación",
  description: "Datos, psicofísico e historial del expediente de un postulante.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <DetalleExpedienteView expedienteId={id} />;
}
