import PageLayout from "@/components/layout/page-layout";
import PrestamoCargoPage from "@/modules/movimientos/ui/prestamo-cargo-page";

export default function PrestamoCargoRoutePage() {
  return (
    <PageLayout
      title="Gestión de Encargaduría"
      description="Asigne temporalmente un cargo a un trabajador"
    >
      <PrestamoCargoPage />
    </PageLayout>
  );
}
