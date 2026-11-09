import SolicitudDetallePage from "@/modules/autogestion/ui/solicitudes/solicitud-detalle-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SolicitudDetallePage id={id} />;
}
