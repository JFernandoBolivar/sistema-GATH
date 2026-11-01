import UsuarioDetallePage from "@/modules/identidad/ui/usuario-detalle-page";

export default async function UsuarioDetalleRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    return (
      <section className="px-6 py-4">
        <p role="alert" className="text-sm text-destructive">
          Usuario inválido.
        </p>
      </section>
    );
  }
  return <UsuarioDetallePage id={numero} />;
}
