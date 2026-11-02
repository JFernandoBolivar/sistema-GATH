import PageLayout from "@/components/layout/page-layout";
import AsignarCargoPage from "@/modules/movimientos/ui/asignar-cargo-page";

export default function AsignarCodigoRoutePage() {
  return (
    <PageLayout
      title="Asignación De Cargos"
      description="Asigne Un Nuevo Código Al Personal"
    >
      <AsignarCargoPage />
    </PageLayout>
  );
}
