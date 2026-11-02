import PageLayout from "@/components/layout/page-layout";
import AsignarCargoEspecialPage from "@/modules/movimientos/ui/asignar-cargo-especial-page";

export default function AsignarCodigoEspecialRoutePage() {
  return (
    <PageLayout
      title="Asignación De Codigos A Nominas Especiales"
      description="Cree un nuevo codigo auto generable segun la nómina especial"
    >
      <AsignarCargoEspecialPage />
    </PageLayout>
  );
}
