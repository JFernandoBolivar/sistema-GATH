import PageLayout from "@/components/layout/page-layout";
import { ControlEntradaQrView } from "@/modules/carnetizacion/ui/components/eventos/control-entrada-qr-view";

export const metadata = {
  title: "Control de Entrada QR | Eventos",
  description: "Validación de acceso en vivo mediante código QR para eventos institucionales.",
};

interface ControlEventosPageProps {
  searchParams: Promise<{ evento_id?: string }>;
}

export default async function ControlEventosPage({ searchParams }: ControlEventosPageProps) {
  const params = await searchParams;
  return (
    <PageLayout
      title="Control de Entrada QR"
      description="Validación continua de credenciales y control de acceso en vivo para garitas y eventos."
    >
      <ControlEntradaQrView initialEventoId={params.evento_id} />
    </PageLayout>
  );
}
