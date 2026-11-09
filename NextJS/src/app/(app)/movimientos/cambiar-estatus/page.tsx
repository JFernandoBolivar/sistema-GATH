import PageLayout from "@/components/layout/page-layout";
import CambiarEstatusPage from "@/modules/movimientos/ui/cambiar-estatus-page";

export default function CambiarEstatusRoutePage() {
  return (
    <PageLayout
      title="Cambiar Estatus Del Empleado"
      description="Gestione El Estatus del Empleado"
    >
      <CambiarEstatusPage />
    </PageLayout>
  );
}
