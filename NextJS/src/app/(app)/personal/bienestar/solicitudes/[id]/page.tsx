import DetalleSolicitudBienestarPage from "@/modules/autogestion/ui/bienestar/detalle-solicitud-bienestar-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="h-full overflow-auto">
      <DetalleSolicitudBienestarPage id={id} />
    </div>
  );
}
