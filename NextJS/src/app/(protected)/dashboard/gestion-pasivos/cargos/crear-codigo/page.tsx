"use client";
import PageLayout from "../../../../../../components/layout/page-layout";
import { CodigoCatalogForm } from "../../components/pasive/codigo-catalog-form";
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
