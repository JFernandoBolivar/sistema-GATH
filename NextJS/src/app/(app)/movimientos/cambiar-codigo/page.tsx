import PageLayout from "@/components/layout/page-layout";
import CambiarCargoPage from "@/modules/movimientos/ui/cambiar-cargo-page";

export default function CambiarCodigoRoutePage() {
  return (
    <PageLayout
      title="Cambiar Cargo"
      description="Asigne Un Cambio de Cargo Al Empleado"
    >
      <CambiarCargoPage />
    </PageLayout>
  );
}
