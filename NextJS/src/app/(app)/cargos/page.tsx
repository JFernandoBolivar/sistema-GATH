import PageLayout from "@/components/layout/page-layout";
import CargosPage from "@/modules/cargos/ui/cargos-page";

/** Thin wrapper (R10): monta la página de cargos del módulo `cargos`. */
export default function CargosRoutePage() {
  return (
    <PageLayout
      title="Listado De Codigos"
      description="Información General y Detalles De los codigos"
    >
      <CargosPage />
    </PageLayout>
  );
}
