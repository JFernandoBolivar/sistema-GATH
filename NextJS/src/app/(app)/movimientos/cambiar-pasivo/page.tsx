import PageLayout from "@/components/layout/page-layout";
import CambiarPasivoPage from "@/modules/movimientos/ui/cambiar-pasivo-page";

export default function CambiarPasivoRoutePage() {
  return (
    <PageLayout
      title="Gestión De Personal"
      description="Gestionar El Personal Trabajador"
    >
      <CambiarPasivoPage />
    </PageLayout>
  );
}
