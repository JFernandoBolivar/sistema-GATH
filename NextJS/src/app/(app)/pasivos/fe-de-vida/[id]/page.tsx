import DetalleRevisionPage from "@/modules/fe-de-vida/ui/bienestar/detalle-revision-page";

export default async function PasivosFeDeVidaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="h-full">
      <DetalleRevisionPage id={id} />
    </div>
  );
}
