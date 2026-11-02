import PageLayout from "@/components/layout/page-layout";
import CargoCrearPage from "@/modules/cargos/ui/cargo-crear-page";

export default function CargoCrearRoutePage() {
  return (
    <PageLayout
      title="Crear Nuevo Código"
      description="Cree nuevos códigos de posición con sus atributos de cargo, ubicación y nómina"
    >
      <CargoCrearPage />
    </PageLayout>
  );
}
