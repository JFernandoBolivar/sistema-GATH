"use client";

import PageLayout from "../../../../../../components/layout/page-layout";
import { CodigoCatalogEspecialForm } from "../../components/movimientos/asignar-codigo-especial-form";

export default function AsignarCodigoEspecialPage() {
  return (
    <PageLayout
      title="Asignación De Codigos A Nominas Especiales"
      description="Cree un nuevo codigo auto generable segun la nómina especial"
    >
      <CodigoCatalogEspecialForm />
    </PageLayout>
  );
}
