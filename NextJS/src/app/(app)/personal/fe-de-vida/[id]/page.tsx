import DetalleRevisionPage from "@/modules/fe-de-vida/ui/bienestar/detalle-revision-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="h-full overflow-auto">
      <DetalleRevisionPage id={id} />
    </div>
  );
}
