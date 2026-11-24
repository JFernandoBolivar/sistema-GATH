import { DetalleIngresoView } from "@/modules/direccion/ui/views/detalle-ingreso-view";

export const metadata = {
  title: "Ingreso | Dirección General",
  description: "Decisión sobre el Punto de Cuenta de ingreso.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <DetalleIngresoView expedienteId={id} />;
}
