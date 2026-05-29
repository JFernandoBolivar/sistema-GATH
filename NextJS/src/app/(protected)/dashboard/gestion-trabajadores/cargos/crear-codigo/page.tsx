"use client";
import { CodigoCatalogForm } from "../../components/employees/codigo-catalog-form";
import PageLayout from "../../../../../../components/layout/page-layout";
export default function AsignarCodigoPage() {
  return (
    <PageLayout
      title="Crear Nuevo Código"
      description="Cree nuevos códigos de posición con sus atributos de cargo, ubicación y nómina"
    >
      <CodigoCatalogForm />
    </PageLayout>
  );
}
